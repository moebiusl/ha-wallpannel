import type { HaRegistries } from "./ha-websocket";
import { getDomain, getFriendlyEntityName, isProbablyUsefulEntity } from "./entity-filter";
import type { HaState } from "./entity-filter";
import { mediaPlayerKey } from "./media";

export function isWallpanelAreaVisible(area: { name?: string } | undefined): boolean {
  return !area?.name?.trim().startsWith("#");
}

/** Weather integrations may expose maps through HA's camera domain. */
export function isWeatherMapCamera(entityId: string, platform: string | undefined | null): boolean {
  return platform === "dwd_weather" || platform === "dwd_weather_maps" || entityId.startsWith("camera.dwd_weather_maps_");
}

/** HA owns entity type, naming, visibility and room assignment. No device-name rules. */
export function discoverHaEntities(states: HaState[], registries: HaRegistries) {
  const stateIds = new Set(states.map((state) => state.entity_id));
  const entries = new Map(registries.entities.map((entry) => [entry.entity_id, entry]));
  const devices = new Map(registries.devices.map((device) => [device.id, device]));
  const areas = new Map(registries.areas.map((area) => [area.area_id, area]));
  const floors = new Map(registries.floors.map((floor) => [floor.floor_id, floor]));
  const preferred = new Map<string, string>();
  for (const entry of registries.entities) {
    const key = mediaPlayerKey(entry);
    if (entry.entity_id.startsWith("media_player.") && entry.platform === "music_assistant" && key &&
      !entry.hidden_by && !entry.disabled_by && !devices.get(entry.device_id || "")?.disabled_by && stateIds.has(entry.entity_id)) {
      preferred.set(key, entry.entity_id);
    }
  }
  return states.map((state) => {
    const registry = entries.get(state.entity_id);
    const device = devices.get(registry?.device_id || "");
    const mediaKey = state.entity_id.startsWith("media_player.") ? mediaPlayerKey(registry) : null;
    const original = registry?.platform === "music_assistant" && mediaKey
      ? registries.entities.find((entry) => entry.platform !== "music_assistant" && mediaPlayerKey(entry) === mediaKey)
      : undefined;
    const areaId = registry?.area_id || device?.area_id || original?.area_id || devices.get(original?.device_id || "")?.area_id || null;
    const area = areas.get(areaId || "");
    const floor = floors.get(area?.floor_id || "");
    const hiddenArea = !isWallpanelAreaVisible(area);
    const weatherMap = getDomain(state.entity_id) === "camera" && isWeatherMapCamera(state.entity_id, registry?.platform);
    return {
      entityId: state.entity_id,
      name: getFriendlyEntityName(state, registry),
      domain: getDomain(state.entity_id),
      state: state.state,
      attributes: state.attributes || {},
      deviceClass: state.attributes?.device_class || null,
      areaId,
      areaName: area?.name || "Ohne Raum",
      floorId: area?.floor_id || null,
      floorName: floor?.name || "Ohne Etage",
      deviceId: registry?.device_id || null,
      deviceName: device?.name_by_user || device?.name || [device?.manufacturer, device?.model].filter(Boolean).join(" ") || "Ohne Gerät",
      platform: registry?.platform || null,
      musicAssistant: registry?.platform === "music_assistant",
      entityCategory: registry?.entity_category || null,
      haEntityHidden: !!(device?.disabled_by || registry?.disabled_by || registry?.hidden_by),
      haHidden: !!(hiddenArea || device?.disabled_by || registry?.disabled_by || registry?.hidden_by),
      visibleByDefault: !hiddenArea && !weatherMap && !device?.disabled_by && isProbablyUsefulEntity(state, registry) &&
        (!mediaKey || !preferred.has(mediaKey) || preferred.get(mediaKey) === state.entity_id)
    };
  });
}

/** Room pages follow HA, including renamed and removed rooms. */
export function resolveHaRoom(areas: Array<{ area_id?: string; name?: string }>, pageId: string, configured: { title?: string; areaId?: string } | undefined) {
  const areaId = configured?.areaId || pageId;
  const area = areas.find((entry) => entry.area_id === areaId);
  if (!area || !isWallpanelAreaVisible(area)) { return { areaId, title: "Raum nicht verfügbar", available: false }; }
  return { areaId, title: area.name || areaId, available: true };
}

/** A snapshot belongs to a camera only when HA gives both the same device. */
export function discoverHaCameras(states: HaState[], registries: HaRegistries) {
  const entities = discoverHaEntities(states, registries);
  const stateIds = new Set(states.map((state) => state.entity_id));
  const images = registries.entities.filter((entry) => entry.entity_id.startsWith("image.") && stateIds.has(entry.entity_id) && !entry.hidden_by && !entry.disabled_by);
  return entities.filter((entity) => {
    if (entity.domain !== "camera" || !entity.visibleByDefault || ["unknown", "unavailable", "off"].includes(entity.state)) { return false; }
    const connectivity = registries.entities.filter((entry) => entity.deviceId && entry.device_id === entity.deviceId && entry.entity_id.startsWith("binary_sensor."))
      .map((entry) => states.find((state) => state.entity_id === entry.entity_id))
      .filter((state) => state?.attributes?.device_class === "connectivity");
    return !connectivity.some((state) => state?.state !== "on");
  }).map((camera) => {
    const snapshots = camera.deviceId ? images.filter((entry) => entry.device_id === camera.deviceId) : [];
    return {
      name: camera.name,
      eventImageEntityId: snapshots.length === 1 ? snapshots[0].entity_id : camera.entityId,
      liveCameraEntityId: camera.entityId,
      haCameraEntityId: camera.entityId,
      streamOverride: ""
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function selectHaRoomEntities<T extends { entityId: string; areaId?: string | null; deviceId?: string | null; visibleByDefault?: boolean; haHidden?: boolean }>(
  entities: T[],
  page: { areaId?: string; enabledDevices?: string[]; enabledEntities?: string[]; hiddenEntities?: string[] }
): T[] {
  const selected = new Set(page.enabledEntities || []);
  const devices = new Set(page.enabledDevices || []);
  const hidden = new Set(page.hiddenEntities || []);
  return entities.filter((entity) => {
    if (entity.haHidden || hidden.has(entity.entityId)) { return false; }
    if (selected.has(entity.entityId)) { return true; }
    if (page.areaId && entity.areaId !== page.areaId) { return false; }
    if (entity.deviceId && devices.has(entity.deviceId)) { return !!entity.visibleByDefault; }
    return !!page.areaId && entity.areaId === page.areaId && !!entity.visibleByDefault;
  });
}
