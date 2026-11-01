import { EntityRegistryEntry } from "./ha-websocket";
// Official direct streams, never a browser-supplied URL.
export const RADIO_STATIONS = [
  {id:"ffh",name:"HIT RADIO FFH",url:"https://mp3.ffh.de/radioffh/hqlivestream.mp3"},
  {id:"rtl",name:"HITRADIO RTL",url:"https://web.radio.hitradio-rtl.de/hrrtl-sachsen/stream/mp3?aggregator=direktlink"}
];

/** Match only known physical identifiers, never a potentially ambiguous room/name. */
export function mediaPlayerKey(entry: EntityRegistryEntry | undefined): string | null {
  if (!entry) { return null; }
  const id = String(entry.unique_id || "");
  if (entry.platform === "apple_tv" && /^(?:[a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(id)) { return "airplay:" + id.replace(/:/g, "").toLowerCase(); }
  if (entry.platform === "music_assistant" && /^ap[a-f0-9]{12}$/i.test(id)) { return "airplay:" + id.slice(2).toLowerCase(); }
  return entry.device_id ? "device:" + entry.device_id : null;
}

export function validPlaylistUri(value: unknown): value is string {
  return typeof value === "string" && value.length <= 800 && /^[a-z][a-z0-9_]*:\/\/playlist\/[^\s]+$/i.test(value);
}
