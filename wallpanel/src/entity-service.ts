/** Only the device operations used by the wallpanel, with a single fixed target. */
const SERVICE_FIELDS: Record<string, Record<string, string[]>> = {
  light: { turn_on: ["brightness_pct", "hs_color", "rgb_color", "color_temp_kelvin"], turn_off: [] },
  climate: { set_temperature: ["temperature"], set_hvac_mode: ["hvac_mode"], turn_on: [], turn_off: [] },
  media_player: { media_play: [], media_pause: [], media_stop: [], media_next_track: [], media_previous_track: [], volume_set: ["volume_level"], select_source: ["source"] },
  number: { set_value: ["value"] },
  input_number: { set_value: ["value"] },
  switch: { turn_on: [], turn_off: [], toggle: [] },
  input_boolean: { turn_on: [], turn_off: [], toggle: [] },
  automation: { turn_on: [], turn_off: [] },
  fan: { turn_on: [], turn_off: [], toggle: [] },
  cover: { open_cover: [], close_cover: [], stop_cover: [] },
  lock: { lock: [], unlock: [] },
  button: { press: [] }, scene: { turn_on: [] }, script: { turn_on: [] }
};
/** Browser-supplied IDs end up in HA URL paths; anything else (e.g. "../") must never reach HA. */
export function isEntityId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(value);
}
export function validateEntityService(entityId: string, service: string, input: unknown): Record<string, unknown> {
  if (!isEntityId(entityId)) { throw new Error("Ungültige Entität"); }
  const fields = SERVICE_FIELDS[entityId.split(".")[0]];
  if (!fields || !Object.prototype.hasOwnProperty.call(fields, service)) { throw new Error("Gerätebefehl nicht freigegeben"); }
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const data: Record<string, unknown> = {};
  for (const field of fields[service]) { if (Object.prototype.hasOwnProperty.call(source, field)) { data[field] = source[field]; } }
  const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  if (data.brightness_pct !== undefined && (!finite(data.brightness_pct) || data.brightness_pct < 0 || data.brightness_pct > 100)) { throw new Error("Ungültige Helligkeit"); }
  if (data.volume_level !== undefined && (!finite(data.volume_level) || data.volume_level < 0 || data.volume_level > 1)) { throw new Error("Ungültige Lautstärke"); }
  if (data.hs_color !== undefined && (!Array.isArray(data.hs_color) || data.hs_color.length !== 2 || !data.hs_color.every(finite) || data.hs_color[0] < 0 || data.hs_color[0] > 360 || data.hs_color[1] < 0 || data.hs_color[1] > 100)) { throw new Error("Ungültige Farbe"); }
  if(data.rgb_color !== undefined && (!Array.isArray(data.rgb_color) || data.rgb_color.length!==3 || !data.rgb_color.every(v=>finite(v)&&Number.isInteger(v)&&v>=0&&v<=255))) { throw new Error("Ungültige RGB-Farbe"); }
  if(data.color_temp_kelvin !== undefined && (!finite(data.color_temp_kelvin) || !Number.isInteger(data.color_temp_kelvin) || data.color_temp_kelvin<1000 || data.color_temp_kelvin>12000)) { throw new Error("Ungültige Weißtemperatur"); }
  if(["hs_color","rgb_color","color_temp_kelvin"].filter(key=>data[key]!==undefined).length>1) { throw new Error("Nur eine Farbeinstellung gleichzeitig."); }
  for (const key of ["temperature", "value"]) { if (data[key] !== undefined && !finite(data[key])) { throw new Error("Ungültiger Zahlenwert"); } }
  for (const key of ["hvac_mode", "source"]) { if (data[key] !== undefined && (typeof data[key] !== "string" || (data[key] as string).length > 200)) { throw new Error("Ungültige Auswahl"); } }
  if (fields[service].length && service !== "turn_on" && fields[service].some((key) => data[key] === undefined)) { throw new Error("Befehlsdaten fehlen"); }
  return data;
}
