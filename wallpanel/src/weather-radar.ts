import fs from "fs";
import path from "path";
import { AxiosInstance } from "axios";
import { berlinClock } from "./waste";

// Regenradar nach dem Vorbild des Apartment-Wallpanels:
// - Radarbilder der letzten zwei Stunden: fertige Kacheln von RainViewer (schnelles CDN, kleine Dateien)
// - Regenbeginn und -ende: 15-Minuten-Modell von Open-Meteo
// - Karte: OpenStreetMap-Kacheln, lokal zwischengespeichert
// Der Server holt nur Kacheln und reicht sie weiter; er rendert und färbt keine Bilder selbst.

type Location = { lat: number; lon: number };
export type RainWindow = { status: "unknown" | "dry" | "wet"; ongoing?: boolean; start?: number; end?: number | null; until?: number };
export type Minutely = { time?: number[]; precipitation?: Array<number | null> } | null | undefined;
export type RadarSummary = {
  location: { latitude: number; longitude: number };
  fetchedAt: number;
  /** Radarbilder (Unix-Sekunden), älteste zuerst. */
  frames: Array<{ time: number; path: string }>;
  status: "ok" | "stale" | "unavailable";
  summary: string;
  /** Kurzform für die Wetterkachel, z. B. „Regen hört gegen 09:50 auf“. Leer, wenn unbekannt. */
  shortSummary: string;
  level: "dry" | "rain" | "soon" | "unknown";
  /** Niederschlag je 15 Minuten (mm) für die nächsten Stunden. */
  series: Array<{ time: number; amount: number }>;
  /** Kartenausschnitt: Zoomstufe und Position des Standorts in Kachelkoordinaten. */
  view: { z: number; x: number; y: number };
};

const RAIN_MM = 0.05;
const ZOOM = 7;
const SUMMARY_TTL_MS = 10 * 60 * 1000;
const STALE_MAX_MS = 3 * 60 * 60 * 1000;
const FRAME_COUNT = 13;
const PNG_MAGIC = "89504e470d0a1a0a";
const MAP_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const RADAR_CACHE_SIZE = 160;

/** Beginn und Ende des nächsten Regens aus den 15-Minuten-Werten (jede Zeit gilt für die 15 Minuten davor). */
export function rainWindow(data: Minutely, now: number): RainWindow {
  const times = data?.time || [], values = data?.precipitation || [];
  const slots = times.map((t, i) => ({ start: t * 1000 - 900000, end: t * 1000, value: values[i] }))
    .filter((slot) => slot.end > now && slot.start < now + 6 * 3600000);
  if (!slots.length || slots.some((slot) => typeof slot.value !== "number" || !Number.isFinite(slot.value))) { return { status: "unknown" }; }
  const first = slots.findIndex((slot) => (slot.value as number) >= RAIN_MM);
  if (first < 0) { return { status: "dry", until: slots[slots.length - 1].end }; }
  let end = first;
  while (end + 1 < slots.length && (slots[end + 1].value as number) >= RAIN_MM) { end++; }
  return { status: "wet", ongoing: slots[first].start <= now, start: slots[first].start, end: end + 1 < slots.length ? slots[end].end : null, until: slots[slots.length - 1].end };
}

export function rainSentences(window: RainWindow): { summary: string; shortSummary: string; level: RadarSummary["level"] } {
  if (window.status === "unknown") { return { summary: "Für den Regenverlauf liegen keine vollständigen Daten vor.", shortSummary: "", level: "unknown" }; }
  if (window.status === "dry") { return { summary: `Bis ca. ${berlinClock(window.until as number)} kein Niederschlag erwartet.`, shortSummary: "Kein Regen in Sicht", level: "dry" }; }
  if (window.ongoing) {
    return window.end
      ? { summary: `Aktuell Niederschlag – voraussichtlich Ende gegen ${berlinClock(window.end)}.`, shortSummary: `Regen hört gegen ${berlinClock(window.end)} auf`, level: "rain" }
      : { summary: `Aktuell Niederschlag – hält voraussichtlich bis mindestens ${berlinClock(window.until as number)} an.`, shortSummary: "Regen hält noch an", level: "rain" };
  }
  const start = window.start as number;
  return {
    summary: `Niederschlag voraussichtlich ab etwa ${berlinClock(start)}.${window.end ? ` Ende gegen ${berlinClock(window.end)}.` : ` Bis ca. ${berlinClock(window.until as number)} ist noch kein Ende erkennbar.`}`,
    shortSummary: `Regen ab etwa ${berlinClock(start)}`,
    level: "soon"
  };
}

/** Kachelkoordinaten (mit Nachkommastellen) eines Standorts bei einer Zoomstufe. */
export function tilePosition(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = 2 ** z, rad = lat * Math.PI / 180;
  return { x: (lon + 180) / 360 * n, y: (1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * n };
}

type Deps = {
  http: AxiosInstance;
  getLocation: () => Promise<Location | null>;
  describeError: (error: unknown) => string;
  cacheDir: string;
  userAgent: string;
  now?: () => number;
};

export class RadarError extends Error { constructor(message: string, public status = 502) { super(message); } }

export function createWeatherRadar(deps: Deps) {
  const now = deps.now || Date.now;
  let cache: { at: number; value: RadarSummary } | null = null;
  let pending: Promise<RadarSummary | null> | null = null;
  const radarTiles = new Map<string, Buffer>();
  const inflight = new Map<string, Promise<Buffer>>();
  const headers = { "User-Agent": deps.userAgent, Accept: "application/json" };

  async function build(): Promise<RadarSummary | null> {
    const home = await deps.getLocation();
    if (!home || !Number.isFinite(home.lat) || !Number.isFinite(home.lon)) { return cache?.value || null; }
    const latitude = Math.round(home.lat * 1000) / 1000, longitude = Math.round(home.lon * 1000) / 1000;
    const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), timezone: "Europe/Berlin", timeformat: "unixtime", minutely_15: "precipitation", forecast_minutely_15: "24", past_minutely_15: "1" });
    const [forecast, radar] = await Promise.allSettled([
      deps.http.get(`https://api.open-meteo.com/v1/forecast?${query}`, { timeout: 15000, headers }),
      deps.http.get("https://api.rainviewer.com/public/weather-maps.json", { timeout: 15000, headers })
    ]);
    if (forecast.status === "rejected" && radar.status === "rejected") {
      console.warn(`Regenradar nicht verfügbar: ${deps.describeError(radar.reason)}`);
      // Letzten guten Stand eine Weile weiterzeigen, statt die Karte leer zu lassen.
      return cache && now() - cache.value.fetchedAt < STALE_MAX_MS ? { ...cache.value, status: "stale" } : null;
    }
    const previous = cache?.value;
    let frames = previous?.frames || [], status: RadarSummary["status"] = previous ? "stale" : "unavailable";
    if (radar.status === "fulfilled") {
      const data = radar.value.data;
      const past = Array.isArray(data?.radar?.past) ? data.radar.past : [];
      const valid = past.filter((f: any) => Number.isInteger(f?.time) && typeof f?.path === "string" && /^\/v2\/radar\/[a-f0-9]{8,32}$/.test(f.path)).slice(-FRAME_COUNT);
      if (data?.host === "https://tilecache.rainviewer.com" && valid.length) {
        frames = valid.map((f: any) => ({ time: f.time as number, path: f.path as string }));
        status = now() / 1000 - frames[frames.length - 1].time > 2400 ? "stale" : "ok";
      }
    } else { console.warn(`Radarbilder nicht erreichbar: ${deps.describeError(radar.reason)}`); }
    let sentences: { summary: string; shortSummary: string; level: RadarSummary["level"] } = previous && forecast.status === "rejected"
      ? { summary: previous.summary, shortSummary: previous.shortSummary, level: previous.level } : { summary: "Für den Regenverlauf liegen keine Daten vor.", shortSummary: "", level: "unknown" };
    let series = previous?.series || [];
    if (forecast.status === "fulfilled") {
      const minutely: Minutely = forecast.value.data?.minutely_15;
      sentences = rainSentences(rainWindow(minutely, now()));
      series = (minutely?.time || []).map((t, i) => ({ time: t * 1000, amount: Number(minutely?.precipitation?.[i]) })).filter((s) => Number.isFinite(s.amount) && s.time > now() - 900000);
    } else { console.warn(`Regenvorhersage nicht erreichbar: ${deps.describeError(forecast.reason)}`); }
    const position = tilePosition(latitude, longitude, ZOOM);
    return { location: { latitude, longitude }, fetchedAt: now(), frames, status, ...sentences, series, view: { z: ZOOM, x: position.x, y: position.y } };
  }

  function refresh(): Promise<RadarSummary | null> {
    if (pending) { return pending; }
    pending = build().then((value) => { if (value) { cache = { at: now(), value }; } return value; }).finally(() => { pending = null; });
    return pending;
  }

  /** Letzter guter Stand, aber nur, solange er nicht zu alt ist. */
  function usableCache(): RadarSummary | null {
    return cache && now() - cache.value.fetchedAt < STALE_MAX_MS ? { ...cache.value, status: "stale" } : null;
  }

  /** Aktuelle Daten (höchstens zehn Minuten alt); bei Fehlern der letzte gute Stand (bis zu drei Stunden). */
  async function getSummary(): Promise<RadarSummary | null> {
    if (cache && now() - cache.at < SUMMARY_TTL_MS) { return cache.value; }
    try { return (await refresh()) || usableCache(); } catch (error) { console.warn(`Regenradar: ${deps.describeError(error)}`); return usableCache(); }
  }

  /** Für die Wetterkachel der Startseite: nie warten, nur Zwischengespeichertes; veraltetes im Hintergrund auffrischen. */
  function getCachedSummary(): RadarSummary | null {
    if (!cache || now() - cache.at >= SUMMARY_TTL_MS) { void refresh().catch(() => undefined); }
    return cache && now() - cache.value.fetchedAt < STALE_MAX_MS ? cache.value : null;
  }

  async function getTile(kind: string, time: number, z: number, x: number, y: number): Promise<Buffer> {
    if (!["map", "radar"].includes(kind) || (kind === "map" && time !== 0)) { throw new RadarError("Ungültige Kartenanfrage.", 400); }
    if (!Number.isInteger(z) || z < 4 || z > 7 || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) { throw new RadarError("Ungültige Kartenkachel.", 400); }
    const summary = await getSummary();
    if (!summary) { throw new RadarError("Regenradar derzeit nicht verfügbar.", 503); }
    const home = tilePosition(summary.location.latitude, summary.location.longitude, z);
    if (Math.abs(x - Math.floor(home.x)) > 4 || Math.abs(y - Math.floor(home.y)) > 4) { throw new RadarError("Karte außerhalb der Wetterregion.", 400); }
    const frame = kind === "radar" ? summary.frames.find((f) => f.time === time) : null;
    if (kind === "radar" && !frame) { throw new RadarError("Radaraufnahme nicht mehr verfügbar.", 404); }
    const key = [kind, time, z, x, y].join("-"), file = path.join(deps.cacheDir, `${key}.png`);
    if (kind === "map") {
      try { const stat = fs.statSync(file); if (now() - stat.mtimeMs < MAP_CACHE_MS) { return fs.readFileSync(file); } } catch { /* nicht im Zwischenspeicher */ }
    } else if (radarTiles.has(key)) { return radarTiles.get(key) as Buffer; }
    const running = inflight.get(key);
    if (running) { return running; }
    const task = (async () => {
      const url = kind === "map" ? `https://tile.openstreetmap.org/${z}/${x}/${y}.png` : `https://tilecache.rainviewer.com${(frame as { path: string }).path}/256/${z}/${x}/${y}/2/1_1.png`;
      let body: Buffer;
      try {
        const response = await deps.http.get(url, { responseType: "arraybuffer", timeout: 12000, headers: { "User-Agent": deps.userAgent } });
        body = Buffer.from(response.data);
      } catch (error) {
        // Alte Kartenkachel lieber zeigen als gar keine.
        if (kind === "map") { try { return fs.readFileSync(file); } catch { /* keine alte Kachel */ } }
        throw new RadarError(`Kartenkachel derzeit nicht erreichbar (${deps.describeError(error)}).`);
      }
      if (body.length > 1024 * 1024 || body.subarray(0, 8).toString("hex") !== PNG_MAGIC) { throw new RadarError("Ungültige Kartenantwort."); }
      if (kind === "map") { fs.mkdirSync(deps.cacheDir, { recursive: true, mode: 0o700 }); fs.writeFileSync(file, body, { mode: 0o600 }); }
      else { if (radarTiles.size >= RADAR_CACHE_SIZE) { radarTiles.delete(radarTiles.keys().next().value as string); } radarTiles.set(key, body); }
      return body;
    })();
    inflight.set(key, task);
    try { return await task; } finally { inflight.delete(key); }
  }

  return { getSummary, getCachedSummary, getTile };
}
