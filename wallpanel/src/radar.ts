import { AxiosInstance } from "axios";
import { PNG } from "pngjs";

// Regenradar mit Zeitleiste über den frei zugänglichen Kartendienst des DWD (GeoServer WMS).
// Die Ebene "Radar_wn-product_1x1km_ger" enthält Radar-Analyse und Vorhersage (Nowcast)
// bis etwa 2 Stunden in die Zukunft in 5-Minuten-Schritten. Der Server holt Karte, Radarbilder
// und die Werte am Standort, speichert sie zwischen und liefert sie an die Tablets aus.

const WMS_URL = "https://maps.dwd.de/geoserver/dwd/wms";
const RADAR_LAYER = "dwd:Radar_wn-product_1x1km_ger";
const BASE_LAYERS = "dwd:Gewaesser,dwd:Laender,dwd:BRD_Orte";
const IMAGE_WIDTH = 640;
const IMAGE_HEIGHT = 360;
const STEP_MINUTES = 10;
const PAST_MINUTES = 60;
const FUTURE_MINUTES = 120;
const LAT_SPAN = 1.0; // Höhe des Kartenausschnitts in Grad (ca. 110 km, Breite ca. 200 km)
const RAIN_DBZ = 20; // ab hier zählt es als Regen (ca. 0,5 mm/h)
const INFO_CACHE_MS = 4 * 60 * 1000;
const FRAME_CACHE_LIMIT = 60;

type Location = { lat: number; lon: number };

// DWD-Legende (dBZ-Untergrenze je Farbe) und die ruhigere Darstellung fürs Wallpanel.
// Schwache Echos (< 14,5 dBZ, meist Niesel/Messrauschen) werden durchsichtig, damit die Karte sichtbar bleibt.
const DWD_PALETTE: { rgb: [number, number, number]; out: [number, number, number, number] }[] = [
  { rgb: [0x99, 0xff, 0xff], out: [0, 0, 0, 0] },            // 7
  { rgb: [0x33, 0xff, 0xff], out: [0, 0, 0, 0] },            // 9,5
  { rgb: [0x00, 0xca, 0xca], out: [0, 0, 0, 0] },            // 12
  { rgb: [0x00, 0x99, 0x34], out: [100, 210, 255, 90] },     // 14,5 – Niesel
  { rgb: [0x4d, 0xbf, 0x1a], out: [100, 210, 255, 150] },    // 19 – leichter Regen
  { rgb: [0x99, 0xcc, 0x00], out: [64, 169, 255, 175] },     // 23,5
  { rgb: [0xcc, 0xe6, 0x00], out: [10, 132, 255, 195] },     // 28 – mäßiger Regen
  { rgb: [0xff, 0xff, 0x00], out: [10, 92, 255, 210] },      // 32,5
  { rgb: [0xff, 0xc4, 0x00], out: [255, 214, 10, 220] },     // 37 – starker Regen
  { rgb: [0xff, 0x89, 0x00], out: [255, 159, 10, 225] },     // 41,5
  { rgb: [0xff, 0x00, 0x00], out: [255, 106, 43, 230] },     // 46
  { rgb: [0xb4, 0x00, 0x00], out: [255, 69, 58, 235] },      // 50,5 – Starkregen
  { rgb: [0x48, 0x48, 0xff], out: [191, 90, 242, 240] },     // 55 – Hagel/Unwetter
  { rgb: [0x00, 0x00, 0xca], out: [191, 90, 242, 240] },
  { rgb: [0x99, 0x00, 0x99], out: [191, 90, 242, 240] },
  { rgb: [0xff, 0x33, 0xff], out: [191, 90, 242, 240] },
  { rgb: [0x00, 0x00, 0x00], out: [191, 90, 242, 240] }
];

/** Färbt ein DWD-Radarbild um (nächstliegende Legendenfarbe → eigene Farbe). */
function recolorRadarPng(input: Buffer): Buffer {
  const png = PNG.sync.read(input);
  const data = png.data;
  const lookup = new Map<number, [number, number, number, number]>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) { continue; }
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let out = lookup.get(key);
    if (!out) {
      let best = DWD_PALETTE[0];
      let bestDistance = Infinity;
      for (const entry of DWD_PALETTE) {
        const dr = data[i] - entry.rgb[0];
        const dg = data[i + 1] - entry.rgb[1];
        const db = data[i + 2] - entry.rgb[2];
        const distance = dr * dr + dg * dg + db * db;
        if (distance < bestDistance) { bestDistance = distance; best = entry; }
      }
      out = best.out;
      lookup.set(key, out);
    }
    data[i] = out[0];
    data[i + 1] = out[1];
    data[i + 2] = out[2];
    data[i + 3] = out[3];
  }
  return PNG.sync.write(png);
}

export type RadarFrame = { time: string; forecast: boolean };

export type RadarInfo = {
  reference: string;
  frames: RadarFrame[];
  bbox: [number, number, number, number];
  home: { x: number; y: number };
  series: { time: string; dbz: number | null }[];
  summary: string;
  level: "dry" | "rain" | "soon";
};

type RadarDeps = {
  http: AxiosInstance;
  getLocation: () => Promise<Location | null>;
  describeError: (error: unknown) => string;
};

function floorToStep(date: Date, minutes: number): Date {
  const result = new Date(date.getTime());
  result.setUTCSeconds(0, 0);
  result.setUTCMinutes(result.getUTCMinutes() - (result.getUTCMinutes() % minutes));
  return result;
}

function isoMinute(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}

function intensityLabel(dbz: number): string {
  if (dbz >= 50) { return "Starkregen"; }
  if (dbz >= 40) { return "starker Regen"; }
  if (dbz >= 30) { return "mäßiger Regen"; }
  return "leichter Regen";
}

export function createRadar(deps: RadarDeps) {
  let infoCache: { at: number; value: RadarInfo } | null = null;
  let infoPromise: Promise<RadarInfo | null> | null = null;
  let baseCache: { key: string; data: Buffer } | null = null;
  const frameCache = new Map<string, Buffer>();

  function computeBbox(location: Location): [number, number, number, number] {
    // Breite so wählen, dass die Karte im Seitenverhältnis des Bildes etwa unverzerrt wirkt.
    const latHalf = LAT_SPAN / 2;
    const lonSpan = LAT_SPAN * (IMAGE_WIDTH / IMAGE_HEIGHT) / Math.cos(location.lat * Math.PI / 180);
    return [location.lon - lonSpan / 2, location.lat - latHalf, location.lon + lonSpan / 2, location.lat + latHalf];
  }

  function getMapUrl(layers: string, bbox: [number, number, number, number], time?: string): string {
    const params = new URLSearchParams({
      service: "WMS",
      version: "1.1.1",
      request: "GetMap",
      layers,
      styles: "",
      srs: "EPSG:4326",
      bbox: bbox.map((value) => value.toFixed(4)).join(","),
      width: String(IMAGE_WIDTH),
      height: String(IMAGE_HEIGHT),
      format: "image/png",
      transparent: "true"
    });
    if (time) { params.set("time", time); }
    return `${WMS_URL}?${params.toString()}`;
  }

  async function fetchPointValue(location: Location, time: string): Promise<{ dbz: number | null; reference: string | null }> {
    const d = 0.01;
    const params = new URLSearchParams({
      service: "WMS",
      version: "1.1.1",
      request: "GetFeatureInfo",
      layers: RADAR_LAYER,
      query_layers: RADAR_LAYER,
      srs: "EPSG:4326",
      bbox: [location.lon - d, location.lat - d, location.lon + d, location.lat + d].map((v) => v.toFixed(4)).join(","),
      width: "3",
      height: "3",
      x: "1",
      y: "1",
      info_format: "application/json",
      time
    });
    const response = await deps.http.get(`${WMS_URL}?${params.toString()}`, { timeout: 15000 });
    const properties = response.data?.features?.[0]?.properties || {};
    const raw = properties.WN_ANALYSIS ?? properties.GRAY_INDEX;
    const dbz = typeof raw === "number" && raw > -30 ? Math.round(raw * 10) / 10 : null;
    return { dbz, reference: typeof properties.REFERENCE_TIME === "string" ? properties.REFERENCE_TIME : null };
  }

  function buildSummary(series: { time: string; dbz: number | null }[], referenceIso: string): { summary: string; level: RadarInfo["level"] } {
    const reference = new Date(referenceIso).getTime();
    const upcoming = series.filter((entry) => new Date(entry.time).getTime() >= reference);
    const isRain = (entry: { dbz: number | null }) => entry.dbz !== null && entry.dbz >= RAIN_DBZ;
    const now = upcoming[0];
    if (!now) { return { summary: "Keine Radardaten verfügbar", level: "dry" }; }
    const minutesUntil = (entry: { time: string }) => Math.max(0, Math.round((new Date(entry.time).getTime() - Date.now()) / 60000));

    if (isRain(now)) {
      const end = upcoming.find((entry) => !isRain(entry));
      const peak = upcoming.reduce((max, entry) => Math.max(max, entry.dbz || 0), 0);
      if (!end) {
        return { summary: `Aktuell ${intensityLabel(peak)} – hält mindestens 2 Stunden an`, level: "rain" };
      }
      return { summary: `Aktuell ${intensityLabel(now.dbz || 0)} – hört gegen ${formatClock(end.time)} auf (in ca. ${minutesUntil(end)} Min.)`, level: "rain" };
    }

    const start = upcoming.find(isRain);
    if (start) {
      return { summary: `${intensityLabel(start.dbz || 0)[0].toUpperCase()}${intensityLabel(start.dbz || 0).slice(1)} ab etwa ${formatClock(start.time)} (in ca. ${minutesUntil(start)} Min.)`, level: "soon" };
    }
    return { summary: "Kein Regen in den nächsten 2 Stunden", level: "dry" };
  }

  async function buildInfo(): Promise<RadarInfo | null> {
    const location = await deps.getLocation();
    if (!location) { return null; }

    // Letzte verfügbare Analyse ermitteln: DWD liefert die Referenzzeit des aktuellen Laufs mit.
    const probeTime = isoMinute(floorToStep(new Date(), 5));
    const probe = await fetchPointValue(location, probeTime);
    const reference = probe.reference ? floorToStep(new Date(probe.reference), 5) : floorToStep(new Date(Date.now() - 10 * 60000), 5);
    const referenceIso = isoMinute(reference);

    // Raster am 10-Minuten-Takt ausrichten, damit Vergangenheit und Vorhersage gleichmäßig sind.
    const anchor = floorToStep(reference, STEP_MINUTES);
    const frames: RadarFrame[] = [];
    // DWD-Vorhersage reicht etwa 115 Minuten über die Referenzzeit hinaus – spätere Bilder wären leer.
    const lastAvailable = reference.getTime() + (FUTURE_MINUTES - 5) * 60000;
    for (let offset = -PAST_MINUTES; offset <= FUTURE_MINUTES; offset += STEP_MINUTES) {
      const time = new Date(anchor.getTime() + offset * 60000);
      if (time.getTime() > lastAvailable) { break; }
      frames.push({ time: isoMinute(time), forecast: time.getTime() > reference.getTime() });
    }

    // Werte am Standort ab "jetzt" für die Aussage, wann Regen kommt oder aufhört.
    const seriesTimes = frames.filter((frame) => new Date(frame.time).getTime() >= anchor.getTime()).map((frame) => frame.time);
    const series = await Promise.all(seriesTimes.map(async (time) => {
      try {
        return { time, dbz: (await fetchPointValue(location, time)).dbz };
      } catch (_error) {
        return { time, dbz: null };
      }
    }));

    const bbox = computeBbox(location);
    const { summary, level } = buildSummary(series, isoMinute(anchor));
    return {
      reference: referenceIso,
      frames,
      bbox,
      home: {
        x: (location.lon - bbox[0]) / (bbox[2] - bbox[0]),
        y: (bbox[3] - location.lat) / (bbox[3] - bbox[1])
      },
      series,
      summary,
      level
    };
  }

  async function getInfo(): Promise<RadarInfo | null> {
    if (infoCache && Date.now() - infoCache.at < INFO_CACHE_MS) { return infoCache.value; }
    if (!infoPromise) {
      infoPromise = buildInfo()
        .then((value) => {
          if (value) {
            infoCache = { at: Date.now(), value };
            prefetchFrames(value);
          }
          return value;
        })
        .catch((error) => {
          console.warn(`Regenradar nicht verfügbar: ${deps.describeError(error)}`);
          return infoCache ? infoCache.value : null;
        })
        .finally(() => { infoPromise = null; });
    }
    return infoPromise;
  }

  /** Alle Bilder im Hintergrund vorladen (3 gleichzeitig), damit die Tablets sie sofort bekommen. */
  function prefetchFrames(info: RadarInfo): void {
    const queue = info.frames.map((frame) => frame.time);
    const worker = async () => {
      while (queue.length) {
        const time = queue.shift()!;
        try { await getFrameImage(time); } catch (_error) { /* einzelnes Bild fehlt – nicht schlimm */ }
      }
    };
    void Promise.all([worker(), worker(), worker()]);
    void getBaseImage().catch(() => undefined);
  }

  async function getBaseImage(): Promise<Buffer | null> {
    const info = await getInfo();
    if (!info) { return null; }
    const key = info.bbox.join(",");
    if (baseCache && baseCache.key === key) { return baseCache.data; }
    const response = await deps.http.get(getMapUrl(BASE_LAYERS, info.bbox), { responseType: "arraybuffer", timeout: 20000 });
    baseCache = { key, data: Buffer.from(response.data) };
    return baseCache.data;
  }

  async function getFrameImage(time: string): Promise<Buffer | null> {
    const info = await getInfo();
    if (!info || !info.frames.some((frame) => frame.time === time)) { return null; }
    // Vorhersagebilder ändern sich mit jedem neuen DWD-Lauf, daher die Referenzzeit im Schlüssel.
    const frame = info.frames.find((entry) => entry.time === time)!;
    const key = `${time}|${frame.forecast ? info.reference : "analyse"}|${info.bbox.join(",")}`;
    const cached = frameCache.get(key);
    if (cached) { return cached; }
    const response = await deps.http.get(getMapUrl(RADAR_LAYER, info.bbox, time), { responseType: "arraybuffer", timeout: 20000 });
    const data = recolorRadarPng(Buffer.from(response.data));
    frameCache.set(key, data);
    while (frameCache.size > FRAME_CACHE_LIMIT) {
      const oldest = frameCache.keys().next().value;
      if (oldest === undefined) { break; }
      frameCache.delete(oldest);
    }
    return data;
  }

  return { getInfo, getBaseImage, getFrameImage };
}
