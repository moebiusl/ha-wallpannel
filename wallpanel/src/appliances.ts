import type { DeviceRegistryEntry, EntityRegistryEntry } from "./ha-websocket";

/**
 * Hausgeräte der Home-Connect-Integration (Backofen, Geschirrspüler …) für die Raumansicht.
 * Die Zuordnung läuft über die technische Kennung am Ende der unique_id (z. B. „BSH.Common.Status.DoorState“),
 * damit sie nicht von Gerätenamen oder der Sprache abhängt. Es wird nur gelesen, nichts geschaltet.
 */
export type ApplianceStatus = "unavailable" | "off" | "ready" | "running" | "paused" | "finished" | "delayed" | "action" | "error" | "unknown";

export type Appliance = {
  id: string;
  name: string;
  kind: "oven" | "dishwasher" | "other";
  /** Raum aus der Geräte-Zuordnung in Home Assistant; null, wenn keiner gesetzt ist. */
  room: string | null;
  status: ApplianceStatus;
  statusText: string;
  /** Programm, das gerade läuft bzw. gewählt ist. */
  program: string | null;
  /** Fortschritt in Prozent (0–100) oder null. */
  progress: number | null;
  /** Voraussichtliches Ende (Unix-Millisekunden) oder null. */
  endsAt: number | null;
  /** Garraumtemperatur in °C (Backofen). */
  temperature: number | null;
  door: "open" | "closed" | "locked" | null;
  childLock: boolean | null;
};

type StateLike = { entity_id: string; state: string; attributes?: Record<string, unknown> };

const STATUS_TEXT: Record<ApplianceStatus, string> = {
  unavailable: "Nicht erreichbar",
  off: "Aus",
  ready: "Bereit",
  running: "Läuft",
  paused: "Pausiert",
  finished: "Fertig",
  delayed: "Startet später",
  action: "Eingriff nötig",
  error: "Störung",
  unknown: "Unbekannt"
};

const OPERATION: Record<string, ApplianceStatus> = {
  inactive: "off", ready: "ready", run: "running", pause: "paused", finished: "finished",
  delayedstart: "delayed", actionrequired: "action", error: "error", aborting: "running"
};

const DISHWASHER_PROGRAMS: Record<string, string> = {
  eco_50: "Eco 50 °C", auto_1: "Auto 35–45 °C", auto_2: "Auto 45–65 °C", auto_3: "Auto 65–75 °C",
  intensiv_70: "Intensiv 70 °C", intensiv_45: "Intensiv 45 °C", quick_45: "Schnell 45 °C", quick_65: "Schnell 65 °C",
  kurz_60: "Kurz 60 °C", normal_65: "Normal 65 °C", glas_40: "Glas 40 °C", night_wash: "Leise", pre_rinse: "Vorspülen",
  machine_care: "Maschinenpflege", mixed_load: "Mischbeladung", maxflexpro: "Max Flex Pro"
};

const OVEN_PROGRAMS: Record<string, string> = {
  hot_air: "Heißluft", hot_air_eco: "Heißluft Eco", hot_air_grill: "Heißluft-Grill", top_bottom_heating: "Ober-/Unterhitze",
  top_bottom_heating_eco: "Ober-/Unterhitze Eco", bottom_heating: "Unterhitze", top_heating: "Oberhitze", pizza_setting: "Pizzastufe",
  intensive_heat: "Intensivhitze", slow_cook: "Langzeitgaren", preheating: "Vorheizen", keep_warm: "Warmhalten", defrost: "Auftauen",
  grill_large_area: "Grill, großflächig", grill_small_area: "Grill, kleinflächig", dough_proving: "Teig gehen lassen", desiccation: "Dörren"
};

function prettyProgram(value: string): string | null {
  if (!value || ["unknown", "unavailable", "none"].includes(value)) { return null; }
  const key = value.toLowerCase().replace(/^.*_program_/, "");
  if (DISHWASHER_PROGRAMS[key]) { return DISHWASHER_PROGRAMS[key]; }
  const oven = key.replace(/^heating_mode_/, "");
  if (OVEN_PROGRAMS[oven]) { return OVEN_PROGRAMS[oven]; }
  const words = key.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

function kindOf(name: string, keys: Set<string>): Appliance["kind"] {
  if (keys.has("Cooking.Oven.Status.CurrentCavityTemperature") || /backofen|oven|herd/i.test(name)) { return "oven"; }
  if (/geschirr|dishwasher|spül/i.test(name) || [...keys].some((key) => key.startsWith("Dishcare.Dishwasher"))) { return "dishwasher"; }
  return "other";
}

function number(value: string | undefined): number | null {
  if (value === undefined) { return null; }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Fasst die Home-Connect-Entitäten je Gerät zusammen. */
export function buildAppliances(states: StateLike[], devices: DeviceRegistryEntry[], entities: EntityRegistryEntry[]): Appliance[] {
  const byEntity = new Map(states.map((state) => [state.entity_id, state]));
  const deviceMap = new Map(devices.map((device) => [device.id, device]));
  const grouped = new Map<string, Map<string, StateLike>>();
  for (const entity of entities) {
    if (entity.platform !== "home_connect" || !entity.device_id || entity.disabled_by || !entity.unique_id) { continue; }
    const key = entity.unique_id.slice(entity.unique_id.lastIndexOf("-") + 1);
    const state = byEntity.get(entity.entity_id);
    if (!state) { continue; }
    const keys = grouped.get(entity.device_id) || new Map<string, StateLike>();
    keys.set(key, state);
    grouped.set(entity.device_id, keys);
  }

  const result: Appliance[] = [];
  for (const [deviceId, keys] of grouped) {
    const operation = keys.get("BSH.Common.Status.OperationState");
    if (!operation) { continue; }
    const device = deviceMap.get(deviceId);
    const name = String(device?.name_by_user || device?.name || "Gerät");
    const connected = keys.get("BSH.Common.Appliance.Connected")?.state;
    const power = keys.get("BSH.Common.Setting.PowerState")?.state;
    let status: ApplianceStatus = OPERATION[operation.state] || (["unavailable", "unknown"].includes(operation.state) ? "unavailable" : "unknown");
    if (connected === "off") { status = "unavailable"; }
    else if (status === "off" && power === "on") { status = "ready"; }
    const active = status === "running" || status === "paused" || status === "delayed";
    const activeProgram = prettyProgram(keys.get("BSH.Common.Root.ActiveProgram")?.state || "");
    const selectedProgram = prettyProgram(keys.get("BSH.Common.Root.SelectedProgram")?.state || "");
    const end = Date.parse(keys.get("BSH.Common.Option.RemainingProgramTime")?.state || "");
    const progress = number(keys.get("BSH.Common.Option.ProgramProgress")?.state);
    const doorRaw = keys.get("BSH.Common.Status.DoorState")?.state;
    const lock = keys.get("BSH.Common.Setting.ChildLock")?.state;
    const kind = kindOf(name, new Set(keys.keys()));
    result.push({
      id: deviceId,
      name,
      kind,
      room: device?.area_id || entities.find((entity) => entity.device_id === deviceId && entity.area_id)?.area_id || null,
      status,
      statusText: STATUS_TEXT[status],
      program: active ? (activeProgram || selectedProgram) : (status === "ready" ? selectedProgram : null),
      progress: active && progress !== null ? Math.max(0, Math.min(100, Math.round(progress))) : null,
      endsAt: active && Number.isFinite(end) ? end : null,
      temperature: kind === "oven" ? number(keys.get("Cooking.Oven.Status.CurrentCavityTemperature")?.state) : null,
      door: doorRaw === "open" || doorRaw === "closed" || doorRaw === "locked" ? doorRaw : null,
      childLock: lock === "on" ? true : lock === "off" ? false : null
    });
  }
  return result.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "de"));
}
