import crypto from "crypto";
const ATTRIBUTES = ["brightness", "supported_color_modes", "color_mode", "hs_color", "rgb_color", "color_temp_kelvin", "min_color_temp_kelvin", "max_color_temp_kelvin", "min_mireds", "max_mireds", "temperature", "current_temperature", "min_temp", "max_temp", "target_temp_step", "hvac_modes", "hvac_action", "supported_features", "media_title", "media_artist", "volume_level", "source", "source_list", "unit_of_measurement", "device_class", "humidity"];
export function projectPanelEntities(entities: Array<Record<string, any>>, states: Array<{entity_id: string; state: string; last_changed?: string; attributes?: Record<string, any>}>) {
  const byId = new Map(states.map(state => [state.entity_id, state]));
  return entities.filter(entity => entity.visibleByDefault && !entity.haHidden && byId.has(entity.entityId)).map(entity => {
    const state = byId.get(entity.entityId)!;
    const attributes: Record<string, any> = {};
    for (const key of ATTRIBUTES) { if (state.attributes?.[key] !== undefined) { attributes[key] = state.attributes[key]; } }
    const picture = state.attributes?.entity_picture;
    return { entityId: entity.entityId, name: state.attributes?.friendly_name || entity.name, domain: entity.domain, areaId: entity.areaId, areaName: entity.areaName, deviceId: entity.deviceId, deviceName: entity.deviceName, lastChanged: state.last_changed, deviceClass: entity.deviceClass, musicAssistant: entity.musicAssistant, platform: entity.platform, state: state.state, attributes,
      artwork: entity.domain === "media_player" && picture ? `/api/media-artwork/${encodeURIComponent(entity.entityId)}?v=${crypto.createHash("sha256").update(String(picture) + String(attributes.media_title || "")).digest("hex").slice(0,12)}` : "" };
  });
}

/** A hidden room does not remove the global weather card; explicit HA hiding still applies. */
export function selectDashboardWeather(entities: Array<Record<string, any>>, states: Map<string, { state: string }>): string | undefined {
  return entities.filter(entity => entity.domain === "weather" && !entity.haEntityHidden &&
    !["diagnostic", "config"].includes(entity.entityCategory) &&
    !["unknown", "unavailable"].includes(states.get(entity.entityId)?.state || "unavailable"))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "de"))[0]?.entityId;
}
