import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Lampengruppen nur für das Wallpanel. Home Assistant bleibt unverändert:
 * - automatisch: durchnummerierte Lampen im selben Raum („Esstisch 4“, „Esstisch 5“) → „Esstisch“
 * - manuell: im Panel zusammengestellte Gruppen
 * Eine Gruppe erscheint im Panel als eine Lampe mit der ID „group:…“.
 */
export type LightGroupConfig = { id: string; name: string; room: string | null; members: string[] };
export type LightGroupState = { autoGroup: boolean; groups: LightGroupConfig[]; ungrouped: string[] };
export type LightGroup = LightGroupConfig & { auto: boolean };
type LightLike = { entityId: string; name: string; areaId?: string | null };
type PanelEntity = { entityId: string; name: string; domain: string; areaId?: string | null; areaName?: string; state: string; attributes: Record<string, any>; [key: string]: any };

const GROUP_ID = /^group:[a-z0-9_:]{1,120}$/;
const COLOR_MODES = ["hs", "rgb", "rgbw", "rgbww", "xy"];

export function isLightGroupId(value: unknown): value is string {
  return typeof value === "string" && GROUP_ID.test(value);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "x";
}

/** „Esstisch 4“ → „Esstisch“, sonst null. */
export function numberedBaseName(name: string): string | null {
  const match = /^(.*\S)\s+\d{1,3}$/.exec(String(name || "").trim());
  return match ? match[1] : null;
}

/** Ermittelt die Gruppen für die aktuell sichtbaren Lampen. Eine Lampe gehört höchstens zu einer Gruppe. */
export function planLightGroups(lights: LightLike[], state: LightGroupState): LightGroup[] {
  const known = new Map(lights.map((light) => [light.entityId, light]));
  const taken = new Set<string>();
  const result: LightGroup[] = [];
  for (const group of state.groups) {
    const members = group.members.filter((id) => known.has(id) && !taken.has(id));
    if (members.length < 2) { continue; }
    members.forEach((id) => taken.add(id));
    result.push({ ...group, members, auto: false });
  }
  if (state.autoGroup) {
    const buckets = new Map<string, { name: string; room: string | null; members: string[] }>();
    for (const light of lights) {
      if (taken.has(light.entityId)) { continue; }
      const base = numberedBaseName(light.name);
      if (!base) { continue; }
      const key = `group:auto:${slug(light.areaId || "none")}:${slug(base)}`;
      const bucket = buckets.get(key) || { name: base, room: light.areaId || null, members: [] };
      bucket.members.push(light.entityId);
      buckets.set(key, bucket);
    }
    for (const [id, bucket] of buckets) {
      if (bucket.members.length < 2 || state.ungrouped.includes(id)) { continue; }
      const members = bucket.members.sort((a, b) => String(known.get(a)?.name).localeCompare(String(known.get(b)?.name), "de", { numeric: true }));
      result.push({ id, name: bucket.name, room: bucket.room, members, auto: true });
    }
  }
  return result;
}

/** Fasst die Mitglieder zu einer Panel-Lampe zusammen: an, sobald eine an ist; Helligkeit = Mittel der eingeschalteten. */
export function lightGroupEntity(group: LightGroup, members: PanelEntity[]): PanelEntity {
  const available = members.filter((m) => !["unavailable", "unknown"].includes(m.state));
  const on = available.filter((m) => m.state === "on");
  const lit = on.filter((m) => typeof m.attributes.brightness === "number");
  const modes = Array.from(new Set(members.flatMap((m) => m.attributes.supported_color_modes || [])));
  const lead = on.find((m) => (m.attributes.supported_color_modes || []).some((mode: string) => COLOR_MODES.includes(mode) || mode === "color_temp"))
    || members.find((m) => (m.attributes.supported_color_modes || []).some((mode: string) => COLOR_MODES.includes(mode) || mode === "color_temp"))
    || members[0];
  const attributes: Record<string, any> = {};
  for (const key of ["color_mode", "hs_color", "rgb_color", "color_temp_kelvin", "min_color_temp_kelvin", "max_color_temp_kelvin", "min_mireds", "max_mireds"]) {
    if (lead?.attributes[key] !== undefined) { attributes[key] = lead.attributes[key]; }
  }
  if (modes.length) { attributes.supported_color_modes = modes; }
  if (lit.length) { attributes.brightness = Math.round(lit.reduce((sum, m) => sum + m.attributes.brightness, 0) / lit.length); }
  const first = members[0];
  return {
    entityId: group.id, name: group.name, domain: "light", areaId: group.room, areaName: first?.areaName,
    deviceId: null, deviceName: "Wallpanel-Gruppe", platform: "wallpanel_group",
    state: !available.length ? "unavailable" : on.length ? "on" : "off", attributes,
    lastChanged: members.map((m) => m.lastChanged).filter(Boolean).sort().pop(),
    group: { auto: group.auto, members: members.map((m) => ({ id: m.entityId, name: m.name, on: m.state === "on", editable: !!m.platform })) }
  };
}

/** Ersetzt gruppierte Lampen in der Panel-Liste durch je eine Gruppen-Lampe. */
export function applyLightGroups(entities: PanelEntity[], groups: LightGroup[]): PanelEntity[] {
  if (!groups.length) { return entities; }
  const byId = new Map(entities.map((e) => [e.entityId, e]));
  const grouped = new Set(groups.flatMap((g) => g.members));
  const out = entities.filter((e) => !grouped.has(e.entityId));
  for (const group of groups) {
    const members = group.members.map((id) => byId.get(id)).filter((e): e is PanelEntity => !!e);
    if (members.length) { out.push(lightGroupEntity(group, members)); }
  }
  return out;
}

export function createLightGroupStore(file: string) {
  let state: LightGroupState = { autoGroup: true, groups: [], ungrouped: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    state = {
      autoGroup: parsed.autoGroup !== false,
      groups: Array.isArray(parsed.groups) ? parsed.groups.filter((g: any) => isLightGroupId(g?.id) && Array.isArray(g.members)) : [],
      ungrouped: Array.isArray(parsed.ungrouped) ? parsed.ungrouped.filter(isLightGroupId) : []
    };
  } catch (error: any) { if (error.code !== "ENOENT") { console.error(`light-groups.json nicht lesbar: ${error.message}`); } }

  function persist(next: LightGroupState): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(next, null, 2), { mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
    state = next;
  }
  function cleanName(name: unknown): string {
    const value = String(name || "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!value) { throw new Error("Bitte einen Namen eingeben."); }
    return value;
  }
  function validMembers(members: unknown, lights: Set<string>): string[] {
    const list = Array.isArray(members) ? Array.from(new Set(members.map(String))) : [];
    if (list.length < 2) { throw new Error("Eine Gruppe braucht mindestens zwei Lampen."); }
    if (list.length > 20) { throw new Error("Höchstens 20 Lampen pro Gruppe."); }
    if (list.some((id) => !lights.has(id))) { throw new Error("Unbekannte Lampe in der Gruppe."); }
    return list;
  }
  /** Neue Gruppe oder bestehende ersetzen. Mitglieder verlassen dabei andere manuelle Gruppen. */
  function save(input: { id?: string; name: unknown; room: string | null; members: unknown; replaces?: string }, lights: Set<string>): LightGroupConfig {
    const members = validMembers(input.members, lights);
    const id = input.id && isLightGroupId(input.id) && !input.id.startsWith("group:auto:") ? input.id : `group:${crypto.randomBytes(6).toString("hex")}`;
    const group: LightGroupConfig = { id, name: cleanName(input.name), room: input.room || null, members };
    const groups = state.groups.filter((g) => g.id !== id)
      .map((g) => ({ ...g, members: g.members.filter((m) => !members.includes(m)) }))
      .filter((g) => g.members.length >= 2);
    const ungrouped = input.replaces && input.replaces.startsWith("group:auto:") && !state.ungrouped.includes(input.replaces)
      ? [...state.ungrouped, input.replaces] : state.ungrouped;
    persist({ ...state, groups: [...groups, group], ungrouped });
    return group;
  }
  /** Löst eine Gruppe auf; eine automatische bleibt danach dauerhaft aufgelöst. */
  function remove(id: string): void {
    if (!isLightGroupId(id)) { throw new Error("Ungültige Gruppe."); }
    if (id.startsWith("group:auto:")) {
      if (!state.ungrouped.includes(id)) { persist({ ...state, ungrouped: [...state.ungrouped, id] }); }
      return;
    }
    persist({ ...state, groups: state.groups.filter((g) => g.id !== id) });
  }
  function setRoom(id: string, room: string): void {
    persist({ ...state, groups: state.groups.map((g) => g.id === id ? { ...g, room } : g) });
  }
  function setAutoGroup(enabled: boolean): void {
    persist({ ...state, autoGroup: !!enabled, ungrouped: enabled ? [] : state.ungrouped });
  }
  return { get: () => state, save, remove, setRoom, setAutoGroup };
}
