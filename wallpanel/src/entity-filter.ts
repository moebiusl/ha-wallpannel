export type HaState = {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
};

export type EntityRegistryEntry = {
  entity_id: string;
  unique_id?: string;
  name?: string | null;
  original_name?: string | null;
  device_id?: string | null;
  area_id?: string | null;
  platform?: string;
  hidden_by?: string | null;
  disabled_by?: string | null;
  entity_category?: string | null;
};

const ALLOWED_DOMAINS = [
  "light",
  "switch",
  "cover",
  "climate",
  "sensor",
  "binary_sensor",
  "camera",
  "lock",
  "fan",
  "button",
  "scene",
  "script",
  "media_player",
  "input_boolean"
];

const ALLOWED_SENSOR_DEVICE_CLASSES = [
  "temperature",
  "humidity",
  "illuminance",
  "power",
  "energy",
  "voltage",
  "current",
  "battery",
  "pressure",
  "carbon_dioxide",
  "pm25",
  "pm10",
  "enum",
  "timestamp",
  "duration"
];

const ALLOWED_BINARY_SENSOR_DEVICE_CLASSES = [
  "motion",
  "occupancy",
  "presence",
  "door",
  "window",
  "garage_door",
  "opening",
  "lock",
  "moisture",
  "smoke",
  "gas",
  "safety",
  "problem",
  "battery"
];

const HIDDEN_ENTITY_ID_PARTS = [
  "rssi",
  "wifi_signal",
  "wi_fi_signal",
  "signal_strength",
  "uptime",
  "ip_address",
  "ip_adresse",
  "firmware",
  "linkquality",
  "last_seen",
  "last_restart",
  "restart_count",
  "update_available",
  "cloud_status"
];

export function getDomain(entityId: string): string {
  return entityId.split(".")[0] || "unknown";
}

export function getFriendlyEntityName(entity: HaState | undefined, registry?: EntityRegistryEntry): string {
  const attrName = entity?.attributes?.friendly_name;
  if (typeof attrName === "string" && attrName.trim().length > 0) {
    return attrName;
  }

  if (registry?.name && registry.name.trim().length > 0) {
    return registry.name;
  }

  if (registry?.original_name && registry.original_name.trim().length > 0) {
    return registry.original_name;
  }

  return entity?.entity_id || registry?.entity_id || "Unbekannt";
}

export function isProbablyUsefulEntity(entity: HaState | undefined, registry?: EntityRegistryEntry): boolean {
  const entityId = entity?.entity_id || registry?.entity_id || "";
  const domain = getDomain(entityId);

  if (!entityId || !ALLOWED_DOMAINS.includes(domain)) {
    return false;
  }

  if (registry?.disabled_by || registry?.hidden_by) {
    return false;
  }

  if (registry?.entity_category === "diagnostic" || registry?.entity_category === "config") {
    return false;
  }

  const lowerEntityId = entityId.toLowerCase();
  for (const hiddenPart of HIDDEN_ENTITY_ID_PARTS) {
    if (lowerEntityId.indexOf(hiddenPart) !== -1) {
      return false;
    }
  }

  const deviceClass = entity?.attributes?.device_class;
  if (domain === "sensor" && typeof deviceClass === "string") {
    return ALLOWED_SENSOR_DEVICE_CLASSES.includes(deviceClass);
  }

  if (domain === "binary_sensor" && typeof deviceClass === "string") {
    return ALLOWED_BINARY_SENSOR_DEVICE_CLASSES.includes(deviceClass);
  }

  if (domain === "sensor" && !deviceClass) {
    return false;
  }

  return true;
}
