import express, { Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HA_URL = process.env.HA_URL || (process.env.SUPERVISOR_TOKEN ? "http://supervisor/core" : undefined);
const HA_TOKEN = process.env.HA_TOKEN || process.env.SUPERVISOR_TOKEN;

if (!HA_URL || !HA_TOKEN) {
  throw new Error("HA_URL/HA_TOKEN fehlt. Im Home-Assistant-Add-on wird SUPERVISOR_TOKEN automatisch genutzt.");
}

const ha = axios.create({
  baseURL: HA_URL,
  headers: {
    Authorization: `Bearer ${HA_TOKEN}`,
    "Content-Type": "application/json"
  },
  timeout: 5000
});

type HaState = {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
};

type WeatherSummary = {
  state: string;
  temperature: string;
  humidity: string;
  windSpeed: string;
  precipitation: string;
  forecastHigh: string;
  forecastLow: string;
};

type LightSummary = {
  entity_id: string;
  name: string;
  state: string;
  brightness: number | null;
  colorMode: string | null;
};

type CameraSummary = {
  entity_id: string;
  name: string;
  state: string;
  imageUrl: string;
  liveUrl: string;
};

type CameraConfig = {
  name: string;
  eventImageEntityId: string;
  liveCameraEntityId: string;
};

const ENTITIES = {
  weather: {
        summary: "weather.forecast_home_2"
 },
  sensors: {
    livingTemp: "sensor.smart_thermostat_valve_03008db6_temperature",
    livingHumidity: "sensor.luftbefeuchter_humidity",
    torStatus: "sensor.esp_tor_tor_status",
    schliessZeit: "sensor.esp_tor_countdown_bis_schliessung",
    fahrZeit: "sensor.esp_tor_fahrzeit_tor",
    gelbeTonneNaechsteLeerung: "sensor.gelbe_tonne",
    blaueTonneNaechsteLeerung: "sensor.papier_tonne",
    restmuellNaechsteLeerung: "sensor.restmuell"
  },
  lights: {
  main: "light.hof",
  stehlampe: "light.stehlampe",
  bulb: "light.msl320_d16d_lightbulb"
    },
    lightGroups: {
    esstischKueche: "light.esstischk",
    esstischWohnzimmer: "light.esstischwz"
    },
  cameras: {
    einfahrtEventImage: "image.einfahrt_event_image",
    hofEventImage: "image.hof_event_image",
    hofVonGarageEventImage: "image.hof_von_garage_event_image",
    werkstattRichtungGartenEventImage: "image.werkstatt_richtung_garten_event_image",
    klingelEventImage: "image.klingel_event_image"
  },
  cameraFeeds: {
    einfahrt: "camera.einfahrt",
    hof: "camera.hof",
    hofVonGarage: "camera.hof_von_garage",
    werkstattRichtungGarten: "camera.werkstatt_richtung_garten",
    klingel: "camera.klingel"
  },
  switches: {
    smartControl: "switch.esp_tor_smarte_steuerung",
    torAutomatik: "switch.esp_tor_tor_automatik",
    torDauerAuf: "switch.esp_tor_tor_dauer_auf"
  },
  buttons: {
    wait60: "button.esp_tor_60s_warten",
    autoOpen: "button.esp_tor_automatik_offnen",
    impulse: "button.esp_tor_tor_impuls"
  }
} as const;

const CAMERA_CONFIGS: CameraConfig[] = [
  {
    name: "Einfahrt",
    eventImageEntityId: ENTITIES.cameras.einfahrtEventImage,
    liveCameraEntityId: ENTITIES.cameraFeeds.einfahrt
  },
  {
    name: "Hof",
    eventImageEntityId: ENTITIES.cameras.hofEventImage,
    liveCameraEntityId: ENTITIES.cameraFeeds.hof
  },
  {
    name: "Hof von Garage",
    eventImageEntityId: ENTITIES.cameras.hofVonGarageEventImage,
    liveCameraEntityId: ENTITIES.cameraFeeds.hofVonGarage
  },
  {
    name: "Werkstatt Richtung Garten",
    eventImageEntityId: ENTITIES.cameras.werkstattRichtungGartenEventImage,
    liveCameraEntityId: ENTITIES.cameraFeeds.werkstattRichtungGarten
  },
  {
    name: "Klingel",
    eventImageEntityId: ENTITIES.cameras.klingelEventImage,
    liveCameraEntityId: ENTITIES.cameraFeeds.klingel
  }
];

async function getEntity(entityId: string): Promise<HaState | null> {
  try {
    const response = await ha.get(`/api/states/${entityId}`);
    return response.data;
  } catch (error) {
    console.error(`Fehler beim Holen von ${entityId}:`, error);
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function readStringAttribute(
  entity: HaState | null,
  keys: string[],
  fallback = "unavailable"
): string {
  if (!entity?.attributes) {
    return fallback;
  }

  const attributes = asRecord(entity.attributes);
  for (const key of keys) {
    const value = attributes[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }

  return fallback;
}

function readNumberAttribute(entity: HaState | null, keys: string[]): number | null {
  if (!entity?.attributes) {
    return null;
  }

  const attributes = asRecord(entity.attributes);
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function mapLight(entity: HaState | null, fallbackName: string): LightSummary {
  const brightness = readNumberAttribute(entity, ["brightness"]);
  const colorMode = readStringAttribute(entity, ["color_mode"], "unknown");
  const friendlyName = readStringAttribute(entity, ["friendly_name"], fallbackName);

  return {
    entity_id: entity?.entity_id ?? fallbackName,
    name: friendlyName,
    state: entity?.state ?? "unavailable",
    brightness,
    colorMode
  };
}

function mapCamera(
  entity: HaState | null,
  fallbackName: string,
  liveCameraEntityId: string
): CameraSummary {
  const friendlyName = readStringAttribute(entity, ["friendly_name"], fallbackName);
  const entityId = entity?.entity_id ?? fallbackName;

  return {
    entity_id: entityId,
    name: friendlyName,
    state: entity?.state ?? "unavailable",
    imageUrl: `/api/camera-image/${encodeURIComponent(entityId)}`,
    liveUrl: `/api/camera-live/${encodeURIComponent(liveCameraEntityId)}?fallbackImage=${encodeURIComponent(entityId)}`
  };
}

function extractWeatherSummary(entity: HaState | null): WeatherSummary {
  const attributes = asRecord(entity?.attributes);
  const forecastRaw = attributes["forecast"];
  const forecast = Array.isArray(forecastRaw) ? forecastRaw : [];
  const firstForecast = forecast.length > 0 ? asRecord(forecast[0]) : {};

  return {
    state: entity?.state ?? "unavailable",
    temperature: readStringAttribute(entity, ["temperature"], "unavailable"),
    humidity: readStringAttribute(entity, ["humidity"], "unavailable"),
    windSpeed: readStringAttribute(entity, ["wind_speed", "wind_bearing_speed"], "unavailable"),
    precipitation:
      firstForecast["precipitation_probability"] !== undefined
        ? String(firstForecast["precipitation_probability"])
        : "unavailable",
    forecastHigh:
      firstForecast["temperature"] !== undefined ? String(firstForecast["temperature"]) : "unavailable",
    forecastLow:
      firstForecast["templow"] !== undefined ? String(firstForecast["templow"]) : "unavailable"
  };
}

async function callService(
  domain: string,
  service: string,
  data: Record<string, unknown>
): Promise<void> {
  await ha.post(`/api/services/${domain}/${service}`, data);
}

async function pressButton(entityId: string): Promise<void> {
  await callService("button", "press", { entity_id: entityId });
}

async function setSwitch(entityId: string, enabled: boolean): Promise<void> {
  await callService("switch", enabled ? "turn_on" : "turn_off", {
    entity_id: entityId
  });
}

async function getImageEntityBytes(entityId: string): Promise<{ contentType: string; data: Buffer } | null> {
  try {
    const response = await ha.get(`/api/image_proxy/${entityId}`, {
      responseType: "arraybuffer",
      headers: {
        Accept: "image/*"
      }
    });

    const contentTypeHeader = response.headers["content-type"];
    const contentType = typeof contentTypeHeader === "string" ? contentTypeHeader : "image/jpeg";

    return {
      contentType,
      data: Buffer.from(response.data)
    };
  } catch (error) {
    console.error(`Fehler beim Holen des Bildes von ${entityId}:`, error);
    return null;
  }
}

async function getCameraProxyBytes(
  cameraEntityId: string
): Promise<{ contentType: string; data: Buffer } | null> {
  try {
    const response = await ha.get(`/api/camera_proxy/${cameraEntityId}`, {
      responseType: "arraybuffer",
      headers: {
        Accept: "image/*"
      }
    });

    const contentTypeHeader = response.headers["content-type"];
    const contentType = typeof contentTypeHeader === "string" ? contentTypeHeader : "image/jpeg";

    return {
      contentType,
      data: Buffer.from(response.data)
    };
  } catch (error) {
    console.error(`Fehler beim Holen des Live-Bildes von ${cameraEntityId}:`, error);
    return null;
  }
}

function isOn(state: string | undefined): boolean {
  return state === "on";
}

function getTorVisual(rawState: string | undefined): { mode: string; text: string } {
  if (!rawState) {
    return { mode: "unknown", text: "Status unbekannt" };
  }

  const state = rawState.toLowerCase();

  if (state === "zu" || state === "closed") {
    return { mode: "closed", text: "Tor geschlossen" };
  }

  if (state === "offen" || state === "open") {
    return { mode: "open", text: "Tor offen" };
  }

  if (
    state === "öffnet" ||
    state === "oeffnet" ||
    state === "fahrt auf" ||
    state === "fährt auf" ||
    state === "opening"
  ) {
    return { mode: "opening", text: "Tor öffnet" };
  }

  if (
    state === "schließt" ||
    state === "schliesst" ||
    state === "fahrt zu" ||
    state === "fährt zu" ||
    state === "closing"
  ) {
    return { mode: "closing", text: "Tor schließt" };
  }

  if (state === "teiloffen") {
    return { mode: "partial", text: "Tor teiloffen" };
  }

  if (state === "stopp" || state === "gestoppt" || state === "stopped") {
    return { mode: "stopped", text: "Tor gestoppt" };
  }

  return { mode: "unknown", text: rawState };
}


app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/camera-image/:entityId", async (req: Request, res: Response) => {
  const rawEntityId = req.params.entityId;
  const entityId = Array.isArray(rawEntityId)
    ? decodeURIComponent(rawEntityId[0])
    : decodeURIComponent(rawEntityId ?? "");
  const image = await getImageEntityBytes(entityId);

  if (!image) {
    res.status(404).json({ ok: false, message: "image not found" });
    return;
  }

  res.setHeader("Content-Type", image.contentType);
  res.setHeader("Cache-Control", "no-store");
  res.send(image.data);
});

app.get("/api/camera-live/:entityId", async (req: Request, res: Response) => {
  const rawEntityId = req.params.entityId;
  const entityId = Array.isArray(rawEntityId)
    ? decodeURIComponent(rawEntityId[0])
    : decodeURIComponent(rawEntityId ?? "");
  const fallbackImageParam = req.query.fallbackImage;
  const fallbackImageEntityId =
    typeof fallbackImageParam === "string" && fallbackImageParam.length > 0
      ? decodeURIComponent(fallbackImageParam)
      : "";

  const liveImage = await getCameraProxyBytes(entityId);
  if (liveImage) {
    res.setHeader("Content-Type", liveImage.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.send(liveImage.data);
    return;
  }

  if (fallbackImageEntityId) {
    const fallbackImage = await getImageEntityBytes(fallbackImageEntityId);
    if (fallbackImage) {
      res.setHeader("Content-Type", fallbackImage.contentType);
      res.setHeader("Cache-Control", "no-store");
      res.send(fallbackImage.data);
      return;
    }
  }

  res.status(404).json({ ok: false, message: "live image not found" });
});

app.get("/api/dashboard", async (_req: Request, res: Response) => {
  const [
    weatherSummary,
    livingTemp,
    livingHumidity,
    mainLight,
    stehlampe,
    bulb,
    esstischKueche,
    esstischWohnzimmer,
    einfahrtEventImage,
    hofEventImage,
    hofVonGarageEventImage,
    werkstattRichtungGartenEventImage,
    klingelEventImage,
    torStatus,
    smartControl,
    torAutomatik,
    torDauerAuf,
    schliessZeit,
    fahrZeit,
    gelbeTonneNaechsteLeerung,
    blaueTonneNaechsteLeerung,
    restmuellNaechsteLeerung
  ] = await Promise.all([
    getEntity(ENTITIES.weather.summary),
    getEntity(ENTITIES.sensors.livingTemp),
    getEntity(ENTITIES.sensors.livingHumidity),
    getEntity(ENTITIES.lights.main),
    getEntity(ENTITIES.lights.stehlampe),
    getEntity(ENTITIES.lights.bulb),
    getEntity(ENTITIES.lightGroups.esstischKueche),
    getEntity(ENTITIES.lightGroups.esstischWohnzimmer),
    getEntity(ENTITIES.cameras.einfahrtEventImage),
    getEntity(ENTITIES.cameras.hofEventImage),
    getEntity(ENTITIES.cameras.hofVonGarageEventImage),
    getEntity(ENTITIES.cameras.werkstattRichtungGartenEventImage),
    getEntity(ENTITIES.cameras.klingelEventImage),
    getEntity(ENTITIES.sensors.torStatus),
    getEntity(ENTITIES.switches.smartControl),
    getEntity(ENTITIES.switches.torAutomatik),
    getEntity(ENTITIES.switches.torDauerAuf),
    getEntity(ENTITIES.sensors.schliessZeit),
    getEntity(ENTITIES.sensors.fahrZeit),
    getEntity(ENTITIES.sensors.gelbeTonneNaechsteLeerung),
    getEntity(ENTITIES.sensors.blaueTonneNaechsteLeerung),
    getEntity(ENTITIES.sensors.restmuellNaechsteLeerung)
  ]);

  const torVisual = getTorVisual(torStatus?.state);
  const weather = extractWeatherSummary(weatherSummary);
  const lights = [
    mapLight(mainLight, "Hof"),
    mapLight(stehlampe, "Stehlampe"),
    mapLight(bulb, "Lampe"),
    mapLight(esstischKueche, "Esstisch Küche"),
    mapLight(esstischWohnzimmer, "Esstisch Wohnzimmer")
  ];
  const cameras = [
    mapCamera(einfahrtEventImage, CAMERA_CONFIGS[0].name, CAMERA_CONFIGS[0].liveCameraEntityId),
    mapCamera(hofEventImage, CAMERA_CONFIGS[1].name, CAMERA_CONFIGS[1].liveCameraEntityId),
    mapCamera(hofVonGarageEventImage, CAMERA_CONFIGS[2].name, CAMERA_CONFIGS[2].liveCameraEntityId),
    mapCamera(
      werkstattRichtungGartenEventImage,
      CAMERA_CONFIGS[3].name,
      CAMERA_CONFIGS[3].liveCameraEntityId
    ),
    mapCamera(klingelEventImage, CAMERA_CONFIGS[4].name, CAMERA_CONFIGS[4].liveCameraEntityId)
  ];

  res.json({
    livingTemp: livingTemp?.state ?? "unavailable",
    livingHumidity: livingHumidity?.state ?? "unavailable",
    weather,
    kitchenLight: mainLight?.state ?? "unavailable",
    lights,
    light1Name: lights[0]?.name ?? "Hof",
    light1State: lights[0]?.state ?? "unavailable",
    light1On: isOn(lights[0]?.state),
    light2Name: lights[1]?.name ?? "Stehlampe",
    light2State: lights[1]?.state ?? "unavailable",
    light2On: isOn(lights[1]?.state),
    light3Name: lights[2]?.name ?? "Lampe",
    light3State: lights[2]?.state ?? "unavailable",
    light3On: isOn(lights[2]?.state),
    cameras,

    torStatus: torStatus?.state ?? "unavailable",
    torVisualMode: torVisual.mode,
    torVisualText: torVisual.text,

    smartControl: isOn(smartControl?.state),
    torAutomatik: isOn(torAutomatik?.state),
    torDauerAuf: isOn(torDauerAuf?.state),
    schliessZeit: schliessZeit?.state ?? "unavailable",
    fahrZeit: fahrZeit?.state ?? "unavailable",
    gelbeTonneNaechsteLeerung: gelbeTonneNaechsteLeerung?.state ?? "unavailable",
    blaueTonneNaechsteLeerung: blaueTonneNaechsteLeerung?.state ?? "unavailable",
    restmuellNaechsteLeerung: restmuellNaechsteLeerung?.state ?? "unavailable",

    updatedAt: new Date().toLocaleString("de-DE")
  });
});

app.post("/api/light/main/on", async (_req: Request, res: Response) => {
  try {
    await callService("light", "turn_on", {
      entity_id: ENTITIES.lights.main
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler beim Einschalten des Lichts:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/light/main/off", async (_req: Request, res: Response) => {
  try {
    await callService("light", "turn_off", {
      entity_id: ENTITIES.lights.main
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler beim Ausschalten des Lichts:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/light/stehlampe/on", async (_req: Request, res: Response) => {
  try {
    await callService("light", "turn_on", {
      entity_id: ENTITIES.lights.stehlampe
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler beim Einschalten der Stehlampe:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/light/stehlampe/off", async (_req: Request, res: Response) => {
  try {
    await callService("light", "turn_off", {
      entity_id: ENTITIES.lights.stehlampe
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler beim Ausschalten der Stehlampe:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/light/bulb/on", async (_req: Request, res: Response) => {
  try {
    await callService("light", "turn_on", {
      entity_id: ENTITIES.lights.bulb
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler beim Einschalten der Lampe:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/light/bulb/off", async (_req: Request, res: Response) => {
  try {
    await callService("light", "turn_off", {
      entity_id: ENTITIES.lights.bulb
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler beim Ausschalten der Lampe:", error);
    res.status(500).json({ ok: false });
  }
});

// BUTTONS
app.post("/api/tor/wait60", async (_req: Request, res: Response) => {
  try {
    await pressButton(ENTITIES.buttons.wait60);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei +60s warten:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/auto-open", async (_req: Request, res: Response) => {
  try {
    await pressButton(ENTITIES.buttons.autoOpen);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Automatik Öffnen:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/impulse", async (_req: Request, res: Response) => {
  try {
    await pressButton(ENTITIES.buttons.impulse);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Tor Impuls:", error);
    res.status(500).json({ ok: false });
  }
});

// SWITCHES
app.post("/api/tor/smart-control/on", async (_req: Request, res: Response) => {
  try {
    await setSwitch(ENTITIES.switches.smartControl, true);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Smarte Steuerung EIN:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/smart-control/off", async (_req: Request, res: Response) => {
  try {
    await setSwitch(ENTITIES.switches.smartControl, false);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Smarte Steuerung AUS:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/automatik/on", async (_req: Request, res: Response) => {
  try {
    await setSwitch(ENTITIES.switches.torAutomatik, true);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Tor Automatik EIN:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/automatik/off", async (_req: Request, res: Response) => {
  try {
    await setSwitch(ENTITIES.switches.torAutomatik, false);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Tor Automatik AUS:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/dauer-auf/on", async (_req: Request, res: Response) => {
  try {
    await setSwitch(ENTITIES.switches.torDauerAuf, true);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Tor Dauer Auf EIN:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/dauer-auf/off", async (_req: Request, res: Response) => {
  try {
    await setSwitch(ENTITIES.switches.torDauerAuf, false);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Tor Dauer Auf AUS:", error);
    res.status(500).json({ ok: false });
  }
});

app.use((_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Wallpanel läuft auf Port ${PORT}`);
});
