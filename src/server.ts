import express, { Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { getHaRegistries, subscribeToStateChanges } from "./ha-websocket";
import { readPanelConfig, writePanelConfig, getConfigPath } from "./panel-config";
import { getDomain, getFriendlyEntityName, isProbablyUsefulEntity } from "./entity-filter";

dotenv.config();

const app = express();

function readFirstExistingFile(paths: string[]): string {
  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) {
        const value = fs.readFileSync(filePath, "utf8").trim();
        if (value) {
          return value;
        }
      }
    } catch (_error) {
      // Ignore unreadable environment files and continue with the next source.
    }
  }
  return "";
}

const PORT = Number(process.env.PORT || 3000);
const HA_URL = process.env.HA_URL || "http://supervisor/core";

// SUPERVISOR_TOKEN is injected by HA into the add-on container (hassio_api: true).
// It authenticates both http://supervisor/... AND the /api/hassio/... passthrough.
// Keep this separate from the user-configured HA_TOKEN (long-lived access token).
const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN || process.env.HASSIO_TOKEN || readFirstExistingFile([
  "/var/run/s6/container_environment/SUPERVISOR_TOKEN",
  "/var/run/s6/container_environment/HASSIO_TOKEN",
  "/run/s6/container_environment/SUPERVISOR_TOKEN",
  "/run/s6/container_environment/HASSIO_TOKEN"
]);

// HA_TOKEN for the regular HA Core REST API.
const HA_TOKEN = process.env.HA_TOKEN || SUPERVISOR_TOKEN || readFirstExistingFile([
  "/var/run/s6/container_environment/HA_TOKEN",
  "/run/s6/container_environment/HA_TOKEN"
]);
const SETTINGS_PIN = process.env.SETTINGS_PIN || "1310";
const GO2RTC_PUBLIC_URL = process.env.GO2RTC_PUBLIC_URL || "";
const HA_TIMEOUT_MS = Number(process.env.HA_TIMEOUT_MS || 15000);
const HA_STATES_CACHE_MS = Number(process.env.HA_STATES_CACHE_MS || 2000);
const HA_STRUCTURE_CACHE_MS = Number(process.env.HA_STRUCTURE_CACHE_MS || 15000);
const WEATHER_FORECAST_CACHE_MS = Number(process.env.WEATHER_FORECAST_CACHE_MS || 30 * 60 * 1000);

function formatGermanDateTime(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unavailable";
  }

  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute} Uhr`;
}

function envValue(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

if (!HA_TOKEN) {
  throw new Error("HA_TOKEN fehlt. Im Home-Assistant-Add-on muss homeassistant_api aktiviert sein, damit der Supervisor-Token bereitsteht.");
}

const ha = axios.create({
  baseURL: HA_URL,
  headers: {
    Authorization: `Bearer ${HA_TOKEN}`,
    "Content-Type": "application/json"
  },
  timeout: HA_TIMEOUT_MS
});

const supervisor = axios.create({
  baseURL: "http://supervisor",
  headers: {
    Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
    "Content-Type": "application/json"
  },
  timeout: 6000
});


function readLocalVersion(): string {
  try {
    const content = fs.readFileSync(path.join(__dirname, "../wallpanel/config.yaml"), "utf8");
    const match = content.match(/^version:\s*["']?([^"'\n\r]+)["']?/m);
    return match ? match[1].trim() : "unbekannt";
  } catch {
    return "unbekannt";
  }
}

type HaStructure = {
  floors: unknown[];
  areas: Array<Record<string, unknown> & { area_id?: string; name?: string }>;
  devices: unknown[];
  entityRegistry: unknown[];
  states: HaState[];
  entities: Array<Record<string, unknown>>;
  tree: Array<Record<string, unknown>>;
};

let statesCache: { at: number; data: HaState[] } | null = null;
let statesRequest: Promise<HaState[]> | null = null;
let structureCache: { at: number; data: HaStructure } | null = null;
let structureRequest: Promise<HaStructure> | null = null;
let weatherForecastCache: { entityId: string; at: number; data: WeatherForecastDay[] } | null = null;

type ActivityEntry = {
  ts: string;
  category: "gate" | "timer" | "system";
  /** "action" = manual/panel trigger, "state" = HA entity state change, "sensor" = numeric sensor reading */
  kind?: "action" | "state" | "sensor";
  action: string;
  ok: boolean;
  detail?: string;
  /** For actions: current torStatus. For state changes: previous state value. */
  context?: string;
  /** Who triggered the action: "Nutzer", "Automatisierung", "API" etc. */
  trigger?: string;
};
const activityLog: ActivityEntry[] = [];

function logActivity(
  category: ActivityEntry["category"],
  action: string,
  ok: boolean,
  detail?: string,
  context?: string,
  kind?: ActivityEntry["kind"],
  trigger?: string
): void {
  activityLog.unshift({ ts: new Date().toISOString(), category, action, ok, detail, context, kind, trigger });
  if (activityLog.length > 500) { activityLog.length = 500; }
}

function readCachedGateState(): string {
  if (!statesCache) { return "unbekannt"; }
  const s = statesCache.data.find((e) => e.entity_id === ENTITIES.sensors.torStatus);
  return s?.state || "unbekannt";
}

export type HaState = {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
};

function describeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ? `HTTP ${error.response.status}` : error.code || "AxiosError";
    return `${status}${error.message ? `: ${error.message}` : ""}`;
  }
  return error instanceof Error ? error.message : String(error);
}

type WeatherSummary = {
  state: string;
  stateLabel: string;
  temperature: string;
  dewPoint: string;
  humidity: string;
  cloudCoverage: string;
  uvIndex: string;
  pressure: string;
  windSpeed: string;
  windBearing: string;
  visibility: string;
  forecast: WeatherForecastDay[];
};

type WeatherForecastDay = {
  datetime: string;
  weekday: string;
  condition: string;
  conditionLabel: string;
  temperature: string;
  templow: string;
  precipitation: string;
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
  liveCameraEntityId: string;
  name: string;
  state: string;
  imageUrl: string;
  liveUrl: string;
  streamUrl: string;
  webrtcUrl: string;
  webrtcFallbackUrl: string;
  mjpegUrl: string;
  mjpegFallbackUrl: string;
  eventUpdatedAt: string;
  eventTimestamp: string;
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
    main: envValue("ENTITY_LIGHT_MAIN", "light.hof"),
    stehlampe: envValue("ENTITY_LIGHT_SECONDARY", "light.stehlampe"),
    bulb: envValue("ENTITY_LIGHT_THIRD", "")
  },
  lightGroups: {
    esstischKueche: "light.esstischk",
    esstischWohnzimmer: "light.esstischwz"
  },
  cameras: {
    einfahrtEventImage: envValue("CAMERA_EINFAHRT_EVENT_IMAGE", "image.einfahrt_event_image"),
    hofEventImage: envValue("CAMERA_HOF_EVENT_IMAGE", "image.hof_event_image"),
    hofVonGarageEventImage: envValue("CAMERA_HOF_VON_GARAGE_EVENT_IMAGE", "image.hof_von_garage_event_image"),
    werkstattRichtungGartenEventImage: envValue("CAMERA_WERKSTATT_GARTEN_EVENT_IMAGE", "image.werkstatt_richtung_garten_event_image"),
    klingelEventImage: envValue("CAMERA_KLINGEL_EVENT_IMAGE", "image.klingel_event_image")
  },
  cameraFeeds: {
    einfahrt: envValue("CAMERA_EINFAHRT_LIVE", "camera.einfahrt"),
    hof: envValue("CAMERA_HOF_LIVE", "camera.hof"),
    hofVonGarage: envValue("CAMERA_HOF_VON_GARAGE_LIVE", "camera.hof_von_garage"),
    werkstattRichtungGarten: envValue("CAMERA_WERKSTATT_GARTEN_LIVE", "camera.werkstatt_richtung_garten"),
    klingel: envValue("CAMERA_KLINGEL_LIVE", "camera.klingel")
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
  },
  binarySensors: {
    endschalterAuf: "binary_sensor.esp_tor_endschalter_tor_auf",
    endschalterZu:  "binary_sensor.esp_tor_endschalter_tor_zu",
    lichtschranke:  "binary_sensor.esp_tor_lichtschranke_tor"
  },
  weatherStation: {
    outdoorTemp: "sensor.gw3000a_outdoor_temperature",
    outdoorHumidity: "sensor.gw3000a_humidity",
    dailyRain: "sensor.gw3000a_daily_rain",
    rainRate: "sensor.gw3000a_rain_rate",
    monthlyRain: "sensor.gw3000a_monthly_rain",
    yearlyRain: "sensor.gw3000a_yearly_rain",
    pressure: "sensor.gw3000a_relative_pressure",
    pressureChange3h: "sensor.luftdruck_anderung_3h",
    barometerForecast: "sensor.barometer_wetterlage",
    windSpeed: "sensor.gw3000a_wind_speed",
    windDirection: "sensor.gw3000a_wind_direction",
    uvIndex: "sensor.gw3000a_uv_index",
    radarCamera: "camera.dwd_weather_maps_precipitation",
    forecastEntity: "weather.status_strehla"
  },
  waterTank: {
    fillLevel: "sensor.hof_wasserstand_test_tank_fullstand",
    liter: "sensor.hof_wasserstand_test_tank_liter",
    height: "sensor.hof_wasserstand_test_tank_hohe",
    ledPanel: "light.hof_wasserstand_test_fullstand_anzeigepanel",
    maxLiter: "number.hof_wasserstand_test_max_tank_liter",
    fullDistance: "number.hof_wasserstand_test_tank_full_distance",
    emptyDistance: "number.hof_wasserstand_test_tank_empty_distance"
  }
} as const;

const CAMERA_CONFIGS: CameraConfig[] = [
  {
    name: envValue("CAMERA_EINFAHRT_NAME", "Einfahrt"),
    eventImageEntityId: ENTITIES.cameras.einfahrtEventImage,
    liveCameraEntityId: envValue("CAMERA_EINFAHRT_STREAM", ENTITIES.cameraFeeds.einfahrt)
  },
  {
    name: envValue("CAMERA_HOF_NAME", "Hof"),
    eventImageEntityId: ENTITIES.cameras.hofEventImage,
    liveCameraEntityId: envValue("CAMERA_HOF_STREAM", ENTITIES.cameraFeeds.hof)
  },
  {
    name: envValue("CAMERA_HOF_VON_GARAGE_NAME", "Hof von Garage"),
    eventImageEntityId: ENTITIES.cameras.hofVonGarageEventImage,
    liveCameraEntityId: envValue("CAMERA_HOF_VON_GARAGE_STREAM", ENTITIES.cameraFeeds.hofVonGarage)
  },
  {
    name: envValue("CAMERA_WERKSTATT_GARTEN_NAME", "Werkstatt Richtung Garten"),
    eventImageEntityId: ENTITIES.cameras.werkstattRichtungGartenEventImage,
    liveCameraEntityId: envValue("CAMERA_WERKSTATT_GARTEN_STREAM", ENTITIES.cameraFeeds.werkstattRichtungGarten)
  },
  {
    name: envValue("CAMERA_KLINGEL_NAME", "Klingel"),
    eventImageEntityId: ENTITIES.cameras.klingelEventImage,
    liveCameraEntityId: envValue("CAMERA_KLINGEL_STREAM", ENTITIES.cameraFeeds.klingel)
  }
];

const ENERGY_ENTITIES = {
  delta2: {
    battery: "sensor.delta2_battery_level",
    mainBattery: "sensor.delta2_main_battery_level",
    status: "sensor.delta2_status",
    chargingState: "sensor.delta2_battery_charging_state",
    totalInPower: "sensor.delta2_total_in_power",
    totalOutPower: "sensor.delta2_total_out_power",
    solarInPower: "sensor.delta2_solar_in_power",
    acInPower: "sensor.delta2_ac_in_power",
    acOutPower: "sensor.delta2_ac_out_power",
    remainingTime: "sensor.delta2_remaining_time",
    batteryTemperature: "sensor.delta2_battery_temperature",
    cycles: "sensor.delta2_cycles"
  },
  powerstream: {
    solar1: "sensor.powerstream_8801_solar_1_watts_2",
    solar2: "sensor.powerstream_8801_solar_2_watts_2",
    solar1Fallback: "sensor.powerstream_8801_solar_1_watts",
    solar2Fallback: "sensor.powerstream_8801_solar_2_watts",
    batteryCharge: "sensor.powerstream_8801_battery_charge_2",
    batteryInputWatts: "sensor.powerstream_8801_battery_input_watts_2",
    inverterOutputWatts: "sensor.powerstream_8801_inverter_output_watts_2",
    smartPlugLoads: "sensor.powerstream_8801_smart_plug_loads_2",
    otherLoads: "sensor.powerstream_8801_other_loads_2",
    status: "sensor.powerstream_8801_status",
    batteryStatus: "sensor.powerstream_8801_battery_status",
    batteryTemperature: "sensor.powerstream_8801_battery_temperature_2",
    inverterTemperature: "sensor.powerstream_8801_inverter_temperature_2",
    chargeTime: "sensor.powerstream_8801_charge_time_2",
    dischargeTime: "sensor.powerstream_8801_discharge_time_2",
    fromBatteryToday: "sensor.powerstream_8801_from_battery_today_energy_total",
    toBatteryToday: "sensor.powerstream_8801_to_battery_today_energy_total",
    pv1Today: "sensor.powerstream_8801_pv1_today_energy_total",
    pv2Today: "sensor.powerstream_8801_pv2_today_energy_total"
  },
  grid: {
    power: "sensor.tibber_pulse_reussner_str_13_leistung",
    feedIn: "sensor.tibber_pulse_reussner_str_13_einspeiseleistung",
    consumption: "sensor.tibber_pulse_reussner_str_13_zahlerstand_verbrauch",
    feedInTotal: "sensor.tibber_pulse_reussner_str_13_zahlerstand_einspeisung"
  }
} as const;

async function getEntity(entityId: string, silent = false): Promise<HaState | null> {
  try {
    const response = await ha.get(`/api/states/${entityId}`);
    return response.data;
  } catch (error) {
    if (!silent) {
      console.error(`Fehler beim Holen von ${entityId}: ${describeError(error)}`);
    }
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
  const entityId = entity?.entity_id ?? fallbackName;
  const eventDate = entity?.state && !["unknown", "unavailable"].includes(entity.state)
    ? entity.state
    : entity?.last_updated || entity?.last_changed;
  const webrtcUrl = getGo2RtcWebUrl(liveCameraEntityId);
  const shortCameraId = liveCameraEntityId.replace(/^camera\./, "");
  const webrtcFallbackUrl = getGo2RtcWebUrl(shortCameraId);
  const mjpegUrl = getGo2RtcMjpegUrl(liveCameraEntityId);
  const mjpegFallbackUrl = getGo2RtcMjpegUrl(shortCameraId);

  return {
    entity_id: entityId,
    liveCameraEntityId,
    name: fallbackName,
    state: entity?.state ?? "unavailable",
    imageUrl: `/api/camera-image/${encodeURIComponent(entityId)}`,
    liveUrl: `/api/camera-stream/${encodeURIComponent(liveCameraEntityId)}?fallbackImage=${encodeURIComponent(entityId)}`,
    streamUrl: `/api/camera-stream/${encodeURIComponent(liveCameraEntityId)}?fallbackImage=${encodeURIComponent(entityId)}`,
    webrtcUrl,
    webrtcFallbackUrl,
    mjpegUrl,
    mjpegFallbackUrl,
    eventUpdatedAt: eventDate ? formatGermanDateTime(eventDate) : "unavailable",
    eventTimestamp: eventDate || ""
  };
}

function getGo2RtcWebUrl(cameraEntityId: string): string {
  const base = GO2RTC_PUBLIC_URL || inferGo2RtcUrlFromHaUrl();
  if (!base) { return ""; }
  const normalized = base.replace(/\/$/, "");
  return `${normalized}/stream.html?src=${encodeURIComponent(cameraEntityId)}`;
}

function getGo2RtcMjpegUrl(cameraEntityId: string): string {
  const base = GO2RTC_PUBLIC_URL || inferGo2RtcUrlFromHaUrl();
  if (!base) { return ""; }
  const normalized = base.replace(/\/$/, "");
  return `${normalized}/api/stream.mjpeg?src=${encodeURIComponent(cameraEntityId)}`;
}

function inferGo2RtcUrlFromHaUrl(): string {
  if (!HA_URL) { return ""; }
  try {
    const parsed = new URL(HA_URL);
    if (parsed.hostname === "supervisor") { return ""; }
    parsed.port = process.env.GO2RTC_PORT || "1984";
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch (_error) {
    return "";
  }
}

function extractWeatherSummary(entity: HaState | null, forecast: WeatherForecastDay[] = []): WeatherSummary {
  return {
    state: entity?.state ?? "unavailable",
    stateLabel: translateWeatherState(entity?.state),
    temperature: readStringAttribute(entity, ["temperature"], "unavailable"),
    dewPoint: readStringAttribute(entity, ["dew_point"], "unavailable"),
    humidity: readStringAttribute(entity, ["humidity"], "unavailable"),
    cloudCoverage: readStringAttribute(entity, ["cloud_coverage"], "unavailable"),
    uvIndex: readStringAttribute(entity, ["uv_index"], "unavailable"),
    pressure: readStringAttribute(entity, ["pressure"], "unavailable"),
    windSpeed: readStringAttribute(entity, ["wind_speed"], "unavailable"),
    windBearing: readStringAttribute(entity, ["wind_bearing"], "unavailable"),
    visibility: readStringAttribute(entity, ["visibility"], "unavailable"),
    forecast
  };
}

async function getWeatherForecast(entityId: string): Promise<WeatherForecastDay[]> {
  const now = Date.now();
  if (weatherForecastCache && weatherForecastCache.entityId === entityId && now - weatherForecastCache.at < WEATHER_FORECAST_CACHE_MS) {
    return weatherForecastCache.data;
  }
  try {
    const response = await ha.post("/api/services/weather/get_forecasts?return_response", {
      entity_id: entityId,
      type: "daily"
    });
    const forecast = normalizeWeatherForecastResponse(response.data, entityId);
    weatherForecastCache = { entityId, at: Date.now(), data: forecast };
    return forecast;
  } catch (error) {
    console.warn(`Wettervorhersage nicht verfügbar: ${describeError(error)}`);
    weatherForecastCache = { entityId, at: Date.now(), data: [] };
    return [];
  }
}

function normalizeWeatherForecastResponse(payload: unknown, entityId: string): WeatherForecastDay[] {
  const data = payload as any;
  const byEntity = data?.service_response?.[entityId] || data?.response?.[entityId] || data?.[entityId] || data;
  const forecast = Array.isArray(byEntity?.forecast) ? byEntity.forecast : Array.isArray(byEntity) ? byEntity : [];
  return forecast.slice(0, 5).map(normalizeWeatherForecastDay);
}

function normalizeWeatherForecastDay(entry: any): WeatherForecastDay {
  const datetime = String(entry?.datetime || "");
  return {
    datetime,
    weekday: formatForecastWeekday(datetime),
    condition: String(entry?.condition || "unavailable"),
    conditionLabel: translateWeatherState(String(entry?.condition || "")),
    temperature: formatForecastNumber(entry?.temperature),
    templow: formatForecastNumber(entry?.templow),
    precipitation: formatForecastNumber(entry?.precipitation)
  };
}

const HOURLY_FORECAST_CACHE_MS = 15 * 60 * 1000;
let hourlyForecastCache: { entityId: string; at: number; data: any[] } | null = null;

async function getHourlyForecast(entityId: string): Promise<any[]> {
  const now = Date.now();
  if (hourlyForecastCache && hourlyForecastCache.entityId === entityId && now - hourlyForecastCache.at < HOURLY_FORECAST_CACHE_MS) {
    return hourlyForecastCache.data;
  }
  try {
    const response = await ha.post("/api/services/weather/get_forecasts?return_response", {
      entity_id: entityId,
      type: "hourly"
    });
    const data = response.data as any;
    const byEntity = data?.service_response?.[entityId] || data?.response?.[entityId] || data?.[entityId] || data;
    const forecast = Array.isArray(byEntity?.forecast) ? byEntity.forecast.slice(0, 12) : [];
    hourlyForecastCache = { entityId, at: Date.now(), data: forecast };
    return forecast;
  } catch (error) {
    console.warn(`Stündliche Vorhersage nicht verfügbar: ${describeError(error)}`);
    hourlyForecastCache = { entityId, at: Date.now(), data: [] };
    return [];
  }
}

type PrecipitationOutlook = { text: string; state: "raining" | "upcoming" | "none" };

function buildPrecipitationOutlook(rainRateEntity: HaState | null, hourlyForecast: any[]): PrecipitationOutlook {
  const rainRate = numericState(rainRateEntity);
  if (rainRate !== null && rainRate > 0) {
    return { text: "Regen jetzt", state: "raining" };
  }

  const now = Date.now();
  for (const entry of hourlyForecast) {
    const precipitation = Number(entry?.precipitation);
    const probability = Number(entry?.precipitation_probability);
    const hasRain = (Number.isFinite(precipitation) && precipitation > 0) || (Number.isFinite(probability) && probability >= 50);
    if (!hasRain) { continue; }

    const entryTime = new Date(String(entry?.datetime || "")).getTime();
    if (!Number.isFinite(entryTime)) { continue; }

    const diffMinutes = Math.round((entryTime - now) / 60000);
    if (diffMinutes <= 0) {
      return { text: "Regen möglich", state: "upcoming" };
    }
    if (diffMinutes < 60) {
      return { text: `Regen in ${diffMinutes} Min.`, state: "upcoming" };
    }
    return { text: `Regen in ${Math.round(diffMinutes / 60)} Std.`, state: "upcoming" };
  }

  return { text: "Kein Niederschlag in Sicht", state: "none" };
}

function formatForecastNumber(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "unavailable";
  }
  return String(value);
}

function formatForecastWeekday(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short"
  }).format(date).replace(".", "");
}

function translateWeatherState(state: string | undefined): string {
  const labels: Record<string, string> = {
    clear: "Klar",
    "clear-night": "Klar",
    cloudy: "Bewölkt",
    fog: "Nebel",
    hail: "Hagel",
    lightning: "Gewitter",
    "lightning-rainy": "Gewitter mit Regen",
    partlycloudy: "Teilweise bewölkt",
    pouring: "Starkregen",
    rainy: "Regen",
    snowy: "Schnee",
    "snowy-rainy": "Schneeregen",
    sunny: "Sonnig",
    windy: "Windig",
    "windy-variant": "Windig"
  };
  return labels[state || ""] || state || "unavailable";
}

function readStateFromMap(states: Map<string, HaState>, entityId: string): HaState | null {
  return states.get(entityId) || null;
}

function numericState(entity: HaState | null): number | null {
  if (!entity || entity.state === "unknown" || entity.state === "unavailable") {
    return null;
  }
  const parsed = Number(String(entity.state).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function metricFromState(states: Map<string, HaState>, entityId: string, label: string) {
  const entity = readStateFromMap(states, entityId);
  const unit = entity?.attributes?.unit_of_measurement ? String(entity.attributes.unit_of_measurement) : "";
  return {
    id: entityId,
    label,
    value: entity?.state ?? "unavailable",
    unit,
    display: entity ? formatMetricDisplay(entity.state, unit) : "unavailable"
  };
}

function formatMetricDisplay(value: string, unit: string): string {
  if (!value || value === "unknown" || value === "unavailable") {
    return "unavailable";
  }
  const numeric = Number(value);
  const formattedValue = Number.isFinite(numeric) && !Number.isInteger(numeric)
    ? String(Math.round(numeric * 10) / 10)
    : value;
  return `${formattedValue}${unit ? ` ${unit}` : ""}`;
}

function sumMetrics(states: Map<string, HaState>, entityIds: string[]): number | null {
  let sum = 0;
  let hasValue = false;
  for (const entityId of entityIds) {
    const value = numericState(readStateFromMap(states, entityId));
    if (value !== null) {
      sum += value;
      hasValue = true;
    }
  }
  return hasValue ? sum : null;
}

async function buildEnergySummary(stateMap?: Map<string, HaState>) {
  stateMap = stateMap || await getStateMap();
  const deltaSolar = numericState(readStateFromMap(stateMap, ENERGY_ENTITIES.delta2.solarInPower));
  const powerstreamSolar = sumMetrics(stateMap, [
    ENERGY_ENTITIES.powerstream.solar1,
    ENERGY_ENTITIES.powerstream.solar2
  ]) ?? sumMetrics(stateMap, [
    ENERGY_ENTITIES.powerstream.solar1Fallback,
    ENERGY_ENTITIES.powerstream.solar2Fallback
  ]);
  const totalSolar = (deltaSolar || 0) + (powerstreamSolar || 0);
  const hasSolar = deltaSolar !== null || powerstreamSolar !== null;
  const gridPower = numericState(readStateFromMap(stateMap, ENERGY_ENTITIES.grid.power));
  const feedInPower = numericState(readStateFromMap(stateMap, ENERGY_ENTITIES.grid.feedIn));
  const currentConsumption = gridPower !== null || hasSolar || feedInPower !== null
    ? Math.max(0, (gridPower || 0) + (hasSolar ? totalSolar : 0) - (feedInPower || 0))
    : null;

  return {
    summary: {
      solarPower: hasSolar ? Math.round(totalSolar) : null,
      solarPowerDisplay: hasSolar ? `${Math.round(totalSolar)} W` : "unavailable",
      powerstreamBatteryDisplay: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.batteryCharge, "Powerstream Akku").display,
      gridPowerDisplay: metricFromState(stateMap, ENERGY_ENTITIES.grid.power, "Netz").display,
      feedInDisplay: metricFromState(stateMap, ENERGY_ENTITIES.grid.feedIn, "Einspeisung").display,
      chargeTimeDisplay: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.chargeTime, "Bis voll").display,
      dischargeTimeDisplay: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.dischargeTime, "Bis leer").display,
      fromBatteryTodayDisplay: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.fromBatteryToday, "Akku heute").display,
      toBatteryTodayDisplay: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.toBatteryToday, "In Akku heute").display,
      consumptionDisplay: currentConsumption === null ? "unavailable" : `${Math.round(currentConsumption)} W`
    },
    delta2: {
      title: "Delta2",
      status: metricFromState(stateMap, ENERGY_ENTITIES.delta2.status, "Status"),
      chargingState: metricFromState(stateMap, ENERGY_ENTITIES.delta2.chargingState, "Ladezustand"),
      mainBattery: metricFromState(stateMap, ENERGY_ENTITIES.delta2.mainBattery, "Hauptakku"),
      totalInPower: metricFromState(stateMap, ENERGY_ENTITIES.delta2.totalInPower, "Eingang"),
      totalOutPower: metricFromState(stateMap, ENERGY_ENTITIES.delta2.totalOutPower, "Ausgang"),
      solarInPower: metricFromState(stateMap, ENERGY_ENTITIES.delta2.solarInPower, "Solar"),
      acInPower: metricFromState(stateMap, ENERGY_ENTITIES.delta2.acInPower, "AC rein"),
      acOutPower: metricFromState(stateMap, ENERGY_ENTITIES.delta2.acOutPower, "AC raus"),
      remainingTime: metricFromState(stateMap, ENERGY_ENTITIES.delta2.remainingTime, "Restzeit"),
      batteryTemperature: metricFromState(stateMap, ENERGY_ENTITIES.delta2.batteryTemperature, "Batterie"),
      cycles: metricFromState(stateMap, ENERGY_ENTITIES.delta2.cycles, "Zyklen")
    },
    powerstream: {
      title: "Powerstream",
      status: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.status, "Status"),
      batteryStatus: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.batteryStatus, "Batterie Status"),
      batteryCharge: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.batteryCharge, "Akku"),
      solarPower: {
        id: "powerstream_solar_sum",
        label: "Solar gesamt",
        value: powerstreamSolar === null ? "unavailable" : String(Math.round(powerstreamSolar)),
        unit: "W",
        display: powerstreamSolar === null ? "unavailable" : `${Math.round(powerstreamSolar)} W`
      },
      batteryInputWatts: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.batteryInputWatts, "Batterie Eingang"),
      chargeTime: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.chargeTime, "Bis voll"),
      dischargeTime: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.dischargeTime, "Bis leer"),
      fromBatteryToday: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.fromBatteryToday, "Akku genutzt heute"),
      toBatteryToday: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.toBatteryToday, "In Akku heute"),
      pv1Today: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.pv1Today, "PV1 heute"),
      pv2Today: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.pv2Today, "PV2 heute"),
      inverterOutputWatts: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.inverterOutputWatts, "Inverter"),
      smartPlugLoads: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.smartPlugLoads, "Smart Plugs"),
      otherLoads: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.otherLoads, "Andere Lasten"),
      batteryTemperature: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.batteryTemperature, "Batterie"),
      inverterTemperature: metricFromState(stateMap, ENERGY_ENTITIES.powerstream.inverterTemperature, "Inverter")
    },
    grid: {
      title: "Haus / Netz",
      power: metricFromState(stateMap, ENERGY_ENTITIES.grid.power, "Netzleistung"),
      feedIn: metricFromState(stateMap, ENERGY_ENTITIES.grid.feedIn, "Einspeisung"),
      consumption: metricFromState(stateMap, ENERGY_ENTITIES.grid.consumption, "Zähler Verbrauch"),
      feedInTotal: metricFromState(stateMap, ENERGY_ENTITIES.grid.feedInTotal, "Zähler Einspeisung")
    },
    updatedAt: formatGermanDateTime(new Date())
  };
}

async function buildWeatherStationSummary(stateMap: Map<string, HaState>) {
  const forecastState = readStateFromMap(stateMap, ENTITIES.weatherStation.forecastEntity);
  const forecastDays = await getWeatherForecast(ENTITIES.weatherStation.forecastEntity);
  const forecast = extractWeatherSummary(forecastState, forecastDays);

  return {
    outdoorTemp: metricFromState(stateMap, ENTITIES.weatherStation.outdoorTemp, "Außentemperatur"),
    outdoorHumidity: metricFromState(stateMap, ENTITIES.weatherStation.outdoorHumidity, "Außenfeuchte"),
    dailyRain: metricFromState(stateMap, ENTITIES.weatherStation.dailyRain, "Regen heute"),
    rainRate: metricFromState(stateMap, ENTITIES.weatherStation.rainRate, "Regenrate"),
    monthlyRain: metricFromState(stateMap, ENTITIES.weatherStation.monthlyRain, "Regen Monat"),
    yearlyRain: metricFromState(stateMap, ENTITIES.weatherStation.yearlyRain, "Regen Jahr"),
    pressure: metricFromState(stateMap, ENTITIES.weatherStation.pressure, "Luftdruck"),
    pressureChange3h: metricFromState(stateMap, ENTITIES.weatherStation.pressureChange3h, "Änderung 3 h"),
    barometerForecast: metricFromState(stateMap, ENTITIES.weatherStation.barometerForecast, "Wetterlage"),
    windSpeed: metricFromState(stateMap, ENTITIES.weatherStation.windSpeed, "Wind"),
    windDirection: metricFromState(stateMap, ENTITIES.weatherStation.windDirection, "Windrichtung"),
    uvIndex: metricFromState(stateMap, ENTITIES.weatherStation.uvIndex, "UV-Index"),
    radarImageUrl: `/api/camera-snapshot/${encodeURIComponent(ENTITIES.weatherStation.radarCamera)}`,
    forecast,
    updatedAt: formatGermanDateTime(new Date())
  };
}

function buildWaterTankSummary(stateMap: Map<string, HaState>) {
  const fillEntity = readStateFromMap(stateMap, ENTITIES.waterTank.fillLevel);
  const ledEntity = readStateFromMap(stateMap, ENTITIES.waterTank.ledPanel);

  return {
    fillLevel: metricFromState(stateMap, ENTITIES.waterTank.fillLevel, "Füllstand"),
    liter: metricFromState(stateMap, ENTITIES.waterTank.liter, "Inhalt"),
    height: metricFromState(stateMap, ENTITIES.waterTank.height, "Wasserhöhe"),
    fillLevelPercent: numericState(fillEntity),
    led: {
      entity_id: ENTITIES.waterTank.ledPanel,
      state: ledEntity?.state ?? "unavailable",
      brightness: readNumberAttribute(ledEntity, ["brightness"])
    },
    calibration: {
      maxLiter: metricFromState(stateMap, ENTITIES.waterTank.maxLiter, "Max. Tankvolumen"),
      fullDistance: metricFromState(stateMap, ENTITIES.waterTank.fullDistance, "Abstand bei Voll"),
      emptyDistance: metricFromState(stateMap, ENTITIES.waterTank.emptyDistance, "Abstand bei Leer")
    },
    updatedAt: formatGermanDateTime(new Date())
  };
}

async function callService(
  domain: string,
  service: string,
  data: Record<string, unknown>
): Promise<void> {
  await ha.post(`/api/services/${domain}/${service}`, data);
  invalidateHaCaches();
}

async function getAllStates(options: { force?: boolean } = {}): Promise<HaState[]> {
  const now = Date.now();
  if (!options.force && statesCache && now - statesCache.at < HA_STATES_CACHE_MS) {
    return statesCache.data;
  }
  if (!options.force && statesRequest) {
    return statesRequest;
  }

  statesRequest = ha.get("/api/states")
    .then((response) => {
      const data = Array.isArray(response.data) ? response.data as HaState[] : [];
      statesCache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      statesRequest = null;
    });

  return statesRequest;
}

async function getStateMap(options: { force?: boolean } = {}): Promise<Map<string, HaState>> {
  return new Map((await getAllStates(options)).map((state) => [state.entity_id, state]));
}

function invalidateHaCaches(): void {
  statesCache = null;
  structureCache = null;
}

function getDeviceName(device: { name?: string | null; name_by_user?: string | null; manufacturer?: string | null; model?: string | null } | undefined): string {
  if (!device) {
    return "Ohne Gerät";
  }
  return device.name_by_user || device.name || [device.manufacturer, device.model].filter(Boolean).join(" ") || "Unbenanntes Gerät";
}

function sortByName<T extends { name?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de"));
}

function sortFloors<T extends { name?: string | null; level?: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aLevel = typeof a.level === "number" ? a.level : Number.MAX_SAFE_INTEGER;
    const bLevel = typeof b.level === "number" ? b.level : Number.MAX_SAFE_INTEGER;
    if (aLevel !== bLevel) {
      return aLevel - bLevel;
    }
    return String(a.name || "").localeCompare(String(b.name || ""), "de");
  });
}

async function buildHaStructureFresh(): Promise<HaStructure> {
  const [states, registries] = await Promise.all([
    getAllStates(),
    getHaRegistries(HA_URL!, HA_TOKEN!)
  ]);

  const stateByEntityId = new Map(states.map((state) => [state.entity_id, state]));
  const entityRegistryById = new Map(registries.entities.map((entry) => [entry.entity_id, entry]));
  const deviceById = new Map(registries.devices.map((device) => [device.id, device]));
  const areaById = new Map(registries.areas.map((area) => [area.area_id, area]));
  const floorById = new Map(registries.floors.map((floor) => [floor.floor_id, floor]));
  const entityCountByArea = new Map<string, number>();

  const mergedEntities = states.map((state) => {
    const registry = entityRegistryById.get(state.entity_id);
    const deviceId = registry?.device_id || null;
    const device = deviceId ? deviceById.get(deviceId) : undefined;
    const areaId = registry?.area_id || device?.area_id || null;
    const area = areaId ? areaById.get(areaId) : undefined;
    const floorId = area?.floor_id || null;
    const floor = floorId ? floorById.get(floorId) : undefined;

    return {
      entityId: state.entity_id,
      name: getFriendlyEntityName(state, registry),
      domain: getDomain(state.entity_id),
      state: state.state,
      attributes: state.attributes || {},
      deviceClass: state.attributes?.device_class || null,
      areaId,
      areaName: area?.name || "Ohne Raum",
      floorId,
      floorName: floor?.name || "Ohne Etage",
      deviceId,
      deviceName: getDeviceName(device),
      platform: registry?.platform || null,
      entityCategory: registry?.entity_category || null,
      visibleByDefault: isProbablyUsefulEntity(state, registry)
    };
  });

  for (const entity of mergedEntities) {
    if (entity.areaId) {
      entityCountByArea.set(entity.areaId, (entityCountByArea.get(entity.areaId) || 0) + 1);
    }
  }

  const floors = sortFloors(registries.floors).map((floor) => ({
    ...floor,
    areaCount: registries.areas.filter((area) => area.floor_id === floor.floor_id).length
  }));

  const areas = sortByName(registries.areas.map((area) => {
    const floor = area.floor_id ? floorById.get(area.floor_id) : undefined;
    return {
      ...area,
      floorName: floor?.name || "Ohne Etage",
      floorLevel: typeof floor?.level === "number" ? floor.level : null,
      entityCount: entityCountByArea.get(area.area_id) || 0
    };
  })).sort((a, b) => {
    const aLevel = typeof a.floorLevel === "number" ? a.floorLevel : Number.MAX_SAFE_INTEGER;
    const bLevel = typeof b.floorLevel === "number" ? b.floorLevel : Number.MAX_SAFE_INTEGER;
    if (aLevel !== bLevel) {
      return aLevel - bLevel;
    }
    const floorNameCompare = String(a.floorName || "").localeCompare(String(b.floorName || ""), "de");
    if (floorNameCompare !== 0) {
      return floorNameCompare;
    }
    return a.name.localeCompare(b.name, "de");
  });

  const treeMap = new Map<string, any>();
  for (const floor of floors) {
    const floorKey = floor.floor_id || "__no_floor";
    treeMap.set(floorKey, {
      floorId: floor.floor_id,
      floorName: floor.name,
      level: typeof floor.level === "number" ? floor.level : null,
      areas: new Map<string, any>()
    });
  }

  for (const area of areas) {
    const floorKey = area.floor_id || "__no_floor";
    if (!treeMap.has(floorKey)) {
      treeMap.set(floorKey, {
        floorId: area.floor_id || null,
        floorName: area.floorName || "Ohne Etage",
        level: typeof area.floorLevel === "number" ? area.floorLevel : null,
        areas: new Map<string, any>()
      });
    }

    treeMap.get(floorKey).areas.set(area.area_id, {
      areaId: area.area_id,
      name: area.name,
      entityCount: area.entityCount,
      devices: new Map<string, any>(),
      entitiesWithoutDevice: []
    });
  }

  for (const entity of mergedEntities) {
    const floorKey = entity.floorId || "__no_floor";
    const areaKey = entity.areaId || "__no_area";
    const deviceKey = entity.deviceId || "__no_device_" + entity.domain;

    if (!treeMap.has(floorKey)) {
      treeMap.set(floorKey, {
        floorId: entity.floorId,
        floorName: entity.floorName,
        level: null,
        areas: new Map<string, any>()
      });
    }

    const floorNode = treeMap.get(floorKey);
    if (!floorNode.areas.has(areaKey)) {
      floorNode.areas.set(areaKey, {
        areaId: entity.areaId,
        name: entity.areaName,
        entityCount: entity.areaId ? entityCountByArea.get(entity.areaId) || 0 : 0,
        devices: new Map<string, any>(),
        entitiesWithoutDevice: []
      });
    }

    const areaNode = floorNode.areas.get(areaKey);
    if (entity.deviceId) {
      if (!areaNode.devices.has(deviceKey)) {
        areaNode.devices.set(deviceKey, {
          deviceId: entity.deviceId,
          name: entity.deviceName,
          entities: []
        });
      }
      areaNode.devices.get(deviceKey).entities.push(entity);
    } else {
      areaNode.entitiesWithoutDevice.push(entity);
    }
  }

  const tree = Array.from(treeMap.values()).map((floor: any) => ({
    floorId: floor.floorId,
    floorName: floor.floorName,
    level: floor.level,
    areas: Array.from(floor.areas.values()).map((area: any) => ({
      areaId: area.areaId,
      name: area.name,
      entityCount: area.entityCount || 0,
      devices: Array.from(area.devices.values()),
      entitiesWithoutDevice: area.entitiesWithoutDevice
    })).sort((a: any, b: any) => a.name.localeCompare(b.name, "de"))
  }));

  return {
    floors,
    areas,
    devices: registries.devices,
    entityRegistry: registries.entities,
    states,
    entities: mergedEntities,
    tree
  };
}

async function buildHaStructure(): Promise<HaStructure> {
  const now = Date.now();
  if (structureCache && now - structureCache.at < HA_STRUCTURE_CACHE_MS) {
    return structureCache.data;
  }
  if (structureRequest) {
    return structureRequest;
  }

  structureRequest = buildHaStructureFresh()
    .then((data) => {
      structureCache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      structureRequest = null;
    });

  return structureRequest;
}

function getServiceForToggle(entityId: string, currentState?: string): { domain: string; service: string } | null {
  const domain = getDomain(entityId);
  if (["light", "switch", "fan", "input_boolean"].includes(domain)) {
    return { domain, service: currentState === "on" ? "turn_off" : "turn_on" };
  }
  if (domain === "cover") {
    return { domain, service: currentState === "open" ? "close_cover" : "open_cover" };
  }
  if (domain === "lock") {
    return { domain, service: currentState === "locked" ? "unlock" : "lock" };
  }
  if (domain === "button") {
    return { domain, service: "press" };
  }
  if (domain === "scene" || domain === "script") {
    return { domain, service: "turn_on" };
  }
  return null;
}

function buildPagePayload(panelId: string, pageId: string, structure: Awaited<ReturnType<typeof buildHaStructure>>) {
  const config = readPanelConfig();
  const panel = config.panels[panelId] || config.panels.default;
  let page = panel?.pages[pageId];

  if (!panel) {
    return { panelId, pageId, page: null, cards: [], entities: [] };
  }

  const area = structure.areas.find((entry: any) => entry.area_id === pageId);
  if (!page) {
    if (area) {
      page = {
        id: pageId,
        title: area.name || pageId,
        areaId: pageId,
        enabledCards: [],
        enabledDevices: [],
        enabledEntities: [],
        hiddenEntities: []
      };
    } else {
      page = panel.pages[panel.defaultPage] || panel.pages.hof;
    }
  }

  if (!page) {
    return { panelId, pageId, panelName: panel.name, page: null, cards: [], entities: [] };
  }

  if (area && !page.areaId) {
    page = {
      ...page,
      title: page.title || area.name || pageId,
      areaId: area.area_id
    };
  }

  const enabledDeviceSet = new Set(page.enabledDevices || []);
  const enabledEntitySet = new Set(page.enabledEntities || []);
  const hiddenEntitySet = new Set(page.hiddenEntities || []);

  const entities = structure.entities.filter((entity: any) => {
    if (page.areaId && entity.areaId !== page.areaId) {
      return false;
    }
    if (hiddenEntitySet.has(entity.entityId)) {
      return false;
    }
    if (enabledEntitySet.has(entity.entityId)) {
      return true;
    }
    if (entity.deviceId && enabledDeviceSet.has(entity.deviceId)) {
      return entity.visibleByDefault;
    }
    if (page.areaId && entity.areaId === page.areaId) {
      return entity.visibleByDefault;
    }
    return false;
  });

  return {
    panelId,
    pageId,
    panelName: panel.name,
    page,
    cards: page.enabledCards || [],
    entities
  };
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
    console.error(`Fehler beim Holen des Bildes von ${entityId}: ${describeError(error)}`);
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
app.use(express.static(path.join(__dirname, "../public"), {
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store");
  }
}));


app.get("/api/ha/states", async (_req: Request, res: Response) => {
  try {
    res.json(await getAllStates());
  } catch (error) {
    console.error(`Fehler beim Laden der HA-States: ${describeError(error)}`);
    res.status(500).json({ ok: false, message: "states unavailable" });
  }
});

app.get("/api/ha/structure", async (_req: Request, res: Response) => {
  try {
    res.json(await buildHaStructure());
  } catch (error) {
    console.error(`Fehler beim Laden der HA-Struktur: ${describeError(error)}`);
    res.status(500).json({ ok: false, message: "structure unavailable" });
  }
});

app.get("/api/panel-config", (_req: Request, res: Response) => {
  res.json({ configPath: getConfigPath(), config: readPanelConfig() });
});

app.post("/api/panel-config", (req: Request, res: Response) => {
  try {
    writePanelConfig(req.body);
    invalidateHaCaches();
    res.json({ ok: true, configPath: getConfigPath() });
  } catch (error) {
    console.error("Fehler beim Speichern der Panel-Konfiguration:", error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/settings/unlock", (req: Request, res: Response) => {
  const pin = String(req.body?.pin || "");
  if (pin !== SETTINGS_PIN) {
    res.status(401).json({ ok: false });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/page/:panelId/:pageId", async (req: Request, res: Response) => {
  try {
    const structure = await buildHaStructure();
    res.json(buildPagePayload(String(req.params.panelId), String(req.params.pageId), structure));
  } catch (error) {
    console.error(`Fehler beim Laden der dynamischen Seite: ${describeError(error)}`);
    res.status(500).json({ ok: false });
  }
});

app.get("/api/energy", async (_req: Request, res: Response) => {
  try {
    res.json(await buildEnergySummary());
  } catch (error) {
    console.error(`Fehler beim Laden der Energiedaten: ${describeError(error)}`);
    res.status(500).json({ ok: false, message: "energy unavailable" });
  }
});

app.get("/api/wetterstation", async (_req: Request, res: Response) => {
  try {
    res.json(await buildWeatherStationSummary(await getStateMap()));
  } catch (error) {
    console.error(`Fehler beim Laden der Wetterstationsdaten: ${describeError(error)}`);
    res.status(500).json({ ok: false, message: "weather station unavailable" });
  }
});

app.get("/api/wassertank", async (_req: Request, res: Response) => {
  try {
    res.json(buildWaterTankSummary(await getStateMap()));
  } catch (error) {
    console.error(`Fehler beim Laden der Wassertankdaten: ${describeError(error)}`);
    res.status(500).json({ ok: false, message: "water tank unavailable" });
  }
});

app.get("/api/camera-snapshot/:entityId", async (req: Request, res: Response) => {
  const entityId = decodeURIComponent(String(req.params.entityId || ""));
  const image = await getCameraProxyBytes(entityId);
  if (!image) {
    res.status(404).json({ ok: false, message: "snapshot not found" });
    return;
  }
  res.setHeader("Content-Type", image.contentType);
  res.setHeader("Cache-Control", "no-store");
  res.send(image.data);
});

app.post("/api/entity/:entityId/toggle", async (req: Request, res: Response) => {
  try {
    const entityId = decodeURIComponent(String(req.params.entityId || ""));
    const state = await getEntity(entityId);
    const action = getServiceForToggle(entityId, state?.state);
    if (!action) {
      res.status(400).json({ ok: false, message: "entity not toggleable" });
      return;
    }
    await callService(action.domain, action.service, { entity_id: entityId });
    res.json({ ok: true, domain: action.domain, service: action.service });
  } catch (error) {
    console.error(`Fehler beim Toggeln der Entität: ${describeError(error)}`);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/entity/:entityId/service", async (req: Request, res: Response) => {
  try {
    const entityId = decodeURIComponent(String(req.params.entityId || ""));
    const domain = getDomain(entityId);
    const service = String(req.body?.service || "");
    const data = req.body?.data && typeof req.body.data === "object" ? req.body.data : {};
    if (!service) {
      res.status(400).json({ ok: false, message: "service missing" });
      return;
    }
    await callService(domain, service, { ...data, entity_id: entityId });
    res.json({ ok: true });
  } catch (error) {
    console.error(`Fehler beim Service-Aufruf: ${describeError(error)}`);
    res.status(500).json({ ok: false });
  }
});

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

app.get("/api/camera-live/:entityId", (req: Request, res: Response) => {
  const rawEntityId = req.params.entityId;
  const entityId = Array.isArray(rawEntityId)
    ? decodeURIComponent(rawEntityId[0])
    : decodeURIComponent(rawEntityId ?? "");
  const fallbackImageParam = req.query.fallbackImage;
  const fallbackImageEntityId =
    typeof fallbackImageParam === "string" && fallbackImageParam.length > 0
      ? decodeURIComponent(fallbackImageParam)
      : "";
  const target = `/api/camera-stream/${encodeURIComponent(entityId)}${fallbackImageEntityId ? `?fallbackImage=${encodeURIComponent(fallbackImageEntityId)}` : ""}`;
  res.redirect(302, target);
});

app.get("/api/camera-stream/:entityId", async (req: Request, res: Response) => {
  const rawEntityId = req.params.entityId;
  const entityId = Array.isArray(rawEntityId)
    ? decodeURIComponent(rawEntityId[0])
    : decodeURIComponent(rawEntityId ?? "");
  const fallbackImageParam = req.query.fallbackImage;
  const fallbackImageEntityId =
    typeof fallbackImageParam === "string" && fallbackImageParam.length > 0
      ? decodeURIComponent(fallbackImageParam)
      : "";

  try {
    const response = await ha.get(`/api/camera_proxy_stream/${entityId}`, {
      responseType: "stream",
      headers: {
        Accept: "multipart/x-mixed-replace,image/*"
      },
      timeout: 30000
    });
    const contentTypeHeader = response.headers["content-type"];
    res.setHeader("Content-Type", typeof contentTypeHeader === "string" ? contentTypeHeader : "multipart/x-mixed-replace");
    res.setHeader("Cache-Control", "no-store");
    response.data.pipe(res);
    return;
  } catch (error) {
    console.warn(`Kamera-Stream nicht verfügbar (${entityId}), nutze Eventbild: ${describeError(error)}`);
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

  res.status(404).json({ ok: false, message: "camera stream not found" });
});

app.get("/api/dashboard", async (_req: Request, res: Response) => {
  const stateMap = await getStateMap();
  const weatherSummary = readStateFromMap(stateMap, ENTITIES.weather.summary);
  const livingTemp = readStateFromMap(stateMap, ENTITIES.sensors.livingTemp);
  const livingHumidity = readStateFromMap(stateMap, ENTITIES.sensors.livingHumidity);
  const mainLight = readStateFromMap(stateMap, ENTITIES.lights.main);
  const stehlampe = readStateFromMap(stateMap, ENTITIES.lights.stehlampe);
  const bulb = ENTITIES.lights.bulb ? readStateFromMap(stateMap, ENTITIES.lights.bulb) : null;
  const esstischKueche = readStateFromMap(stateMap, ENTITIES.lightGroups.esstischKueche);
  const esstischWohnzimmer = readStateFromMap(stateMap, ENTITIES.lightGroups.esstischWohnzimmer);
  const einfahrtEventImage = readStateFromMap(stateMap, ENTITIES.cameras.einfahrtEventImage);
  const hofEventImage = readStateFromMap(stateMap, ENTITIES.cameras.hofEventImage);
  const hofVonGarageEventImage = readStateFromMap(stateMap, ENTITIES.cameras.hofVonGarageEventImage);
  const werkstattRichtungGartenEventImage = readStateFromMap(stateMap, ENTITIES.cameras.werkstattRichtungGartenEventImage);
  const klingelEventImage = readStateFromMap(stateMap, ENTITIES.cameras.klingelEventImage);
  const torStatus = readStateFromMap(stateMap, ENTITIES.sensors.torStatus);
  const smartControl = readStateFromMap(stateMap, ENTITIES.switches.smartControl);
  const torAutomatik = readStateFromMap(stateMap, ENTITIES.switches.torAutomatik);
  const torDauerAuf = readStateFromMap(stateMap, ENTITIES.switches.torDauerAuf);
  const schliessZeit = readStateFromMap(stateMap, ENTITIES.sensors.schliessZeit);
  const fahrZeit = readStateFromMap(stateMap, ENTITIES.sensors.fahrZeit);
  const gelbeTonneNaechsteLeerung = readStateFromMap(stateMap, ENTITIES.sensors.gelbeTonneNaechsteLeerung);
  const blaueTonneNaechsteLeerung = readStateFromMap(stateMap, ENTITIES.sensors.blaueTonneNaechsteLeerung);
  const restmuellNaechsteLeerung = readStateFromMap(stateMap, ENTITIES.sensors.restmuellNaechsteLeerung);

  const rainRateEntity = readStateFromMap(stateMap, ENTITIES.weatherStation.rainRate);

  const torVisual = getTorVisual(torStatus?.state);
  const [weatherForecast, homeHourlyForecast] = await Promise.all([
    getWeatherForecast(ENTITIES.weather.summary),
    getHourlyForecast(ENTITIES.weather.summary)
  ]);
  const weather = extractWeatherSummary(weatherSummary, weatherForecast);
  const precipitationOutlook = buildPrecipitationOutlook(rainRateEntity, homeHourlyForecast);
  const lights = [
    mapLight(mainLight, "Hof"),
    mapLight(stehlampe, "Stehlampe"),
    ...(ENTITIES.lights.bulb ? [mapLight(bulb, "Lampe")] : []),
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
  const energy = await buildEnergySummary(stateMap);
  const waterTank = buildWaterTankSummary(stateMap);

  res.json({
    livingTemp: livingTemp?.state ?? "unavailable",
    livingHumidity: livingHumidity?.state ?? "unavailable",
    weather,
    precipitationOutlook,
    energy,
    waterTank,
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

    updatedAt: formatGermanDateTime(new Date())
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
  if (!ENTITIES.lights.bulb) {
    res.status(404).json({ ok: false, message: "third light is not configured" });
    return;
  }

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
  if (!ENTITIES.lights.bulb) {
    res.status(404).json({ ok: false, message: "third light is not configured" });
    return;
  }

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
  const ctx = readCachedGateState();
  try {
    await pressButton(ENTITIES.buttons.wait60);
    logActivity("gate", "+60s warten", true, undefined, ctx);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei +60s warten:", error);
    logActivity("gate", "+60s warten", false, describeError(error), ctx);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/auto-open", async (_req: Request, res: Response) => {
  const ctx = readCachedGateState();
  try {
    await pressButton(ENTITIES.buttons.autoOpen);
    logActivity("gate", "Auto-Öffnen", true, undefined, ctx);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Automatik Öffnen:", error);
    logActivity("gate", "Auto-Öffnen", false, describeError(error), ctx);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/impulse", async (_req: Request, res: Response) => {
  const ctx = readCachedGateState();
  try {
    await pressButton(ENTITIES.buttons.impulse);
    logActivity("gate", "Impuls", true, undefined, ctx);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Tor Impuls:", error);
    logActivity("gate", "Impuls", false, describeError(error), ctx);
    res.status(500).json({ ok: false });
  }
});

// SWITCHES
app.post("/api/tor/smart-control/on", async (_req: Request, res: Response) => {
  const ctx = readCachedGateState();
  try {
    await setSwitch(ENTITIES.switches.smartControl, true);
    logActivity("gate", "Smarte Steuerung EIN", true, undefined, ctx);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Smarte Steuerung EIN:", error);
    logActivity("gate", "Smarte Steuerung EIN", false, describeError(error), ctx);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/smart-control/off", async (_req: Request, res: Response) => {
  const ctx = readCachedGateState();
  try {
    await setSwitch(ENTITIES.switches.smartControl, false);
    logActivity("gate", "Smarte Steuerung AUS", true, undefined, ctx);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Smarte Steuerung AUS:", error);
    logActivity("gate", "Smarte Steuerung AUS", false, describeError(error), ctx);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/automatik/on", async (_req: Request, res: Response) => {
  const ctx = readCachedGateState();
  try {
    await setSwitch(ENTITIES.switches.torAutomatik, true);
    logActivity("gate", "Automatik EIN", true, undefined, ctx);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Tor Automatik EIN:", error);
    logActivity("gate", "Automatik EIN", false, describeError(error), ctx);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/automatik/off", async (_req: Request, res: Response) => {
  const ctx = readCachedGateState();
  try {
    await setSwitch(ENTITIES.switches.torAutomatik, false);
    logActivity("gate", "Automatik AUS", true, undefined, ctx);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Tor Automatik AUS:", error);
    logActivity("gate", "Automatik AUS", false, describeError(error), ctx);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/dauer-auf/on", async (_req: Request, res: Response) => {
  const ctx = readCachedGateState();
  try {
    await setSwitch(ENTITIES.switches.torDauerAuf, true);
    logActivity("gate", "Dauerauf EIN", true, undefined, ctx);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Tor Dauer Auf EIN:", error);
    logActivity("gate", "Dauerauf EIN", false, describeError(error), ctx);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/tor/dauer-auf/off", async (_req: Request, res: Response) => {
  const ctx = readCachedGateState();
  try {
    await setSwitch(ENTITIES.switches.torDauerAuf, false);
    logActivity("gate", "Dauerauf AUS", true, undefined, ctx);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler bei Tor Dauer Auf AUS:", error);
    logActivity("gate", "Dauerauf AUS", false, describeError(error), ctx);
    res.status(500).json({ ok: false });
  }
});

app.get("/api/automations", async (_req: Request, res: Response) => {
  try {
    const states = await getAllStates();
    const automations = states
      .filter((s) => s.entity_id.startsWith("automation."))
      .sort((a, b) => {
        const nameA = String(a.attributes?.friendly_name || a.entity_id).toLowerCase();
        const nameB = String(b.attributes?.friendly_name || b.entity_id).toLowerCase();
        return nameA.localeCompare(nameB, "de");
      });
    res.json(automations);
  } catch (error) {
    console.error("Fehler beim Laden der Automationen:", describeError(error));
    res.status(500).json([]);
  }
});

let lastBoilerTimerState = "";
app.get("/api/timer/boiler", async (_req: Request, res: Response) => {
  const entity = await getEntity("timer.boiler_timer_10min");
  const currentState = entity ? entity.state : "not found";
  if (currentState !== lastBoilerTimerState) {
    lastBoilerTimerState = currentState;
  }
  res.json(entity || { entity_id: "timer.boiler_timer_10min", state: "idle", attributes: {} });
});

app.post("/api/timer/boiler/reset", async (_req: Request, res: Response) => {
  try {
    await callService("timer", "start", {
      entity_id: "timer.boiler_timer_10min",
      duration: "0:10:00"
    });
    logActivity("timer", "Boiler-Timer auf 10 min gesetzt", true);
    res.json({ ok: true });
  } catch (error) {
    console.error("Fehler beim Zurücksetzen des Boiler-Timers:", describeError(error));
    logActivity("timer", "Boiler-Timer auf 10 min gesetzt", false, describeError(error));
    res.status(500).json({ ok: false });
  }
});

app.get("/api/activity-log", (_req: Request, res: Response) => {
  const category = String(_req.query.category || "");
  const entries = category
    ? activityLog.filter((e) => e.category === category)
    : activityLog;
  res.json(entries.slice(0, 300));
});

app.get("/api/ha-logbook", async (_req: Request, res: Response) => {
  try {
    const hours = Math.min(Number(_req.query.hours) || 24, 72);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const response = await ha.get(`/api/logbook/${since}`);
    const entries = Array.isArray(response.data) ? response.data : [];
    const filtered = entries.filter((e: Record<string, unknown>) => e.domain === "automation");
    res.json(filtered);
  } catch (error) {
    console.error("Fehler beim Laden des HA-Logbuchs:", describeError(error));
    res.status(500).json([]);
  }
});

app.get("/api/system-sensors", async (_req: Request, res: Response) => {
  try {
    const states = await getAllStates();
    const sensors = states
      .filter((s) => s.entity_id.startsWith("sensor.system_monitor_") &&
        s.state !== "unavailable" && s.state !== "unknown")
      .sort((a, b) => {
        const nameA = String(a.attributes?.friendly_name || a.entity_id).toLowerCase();
        const nameB = String(b.attributes?.friendly_name || b.entity_id).toLowerCase();
        return nameA.localeCompare(nameB, "de");
      });
    res.json(sensors);
  } catch (error) {
    console.error("Fehler beim Laden der System-Sensoren:", describeError(error));
    res.status(500).json([]);
  }
});

async function fetchAddons(): Promise<unknown[]> {
  try {
    const response = await supervisor.get("/addons");
    return response.data?.data?.addons ?? [];
  } catch (directErr) {
    console.warn(`[addons] Supervisor nicht erreichbar (${describeError(directErr)}), versuche HA Core Proxy...`);
    try {
      const response = await ha.get("/api/hassio/addons");
      return response.data?.data?.addons ?? [];
    } catch (fallbackErr) {
      console.warn(`[addons] HA Core Proxy fehlgeschlagen (${describeError(fallbackErr)})`);
      return [];
    }
  }
}

app.get("/api/addons", async (_req: Request, res: Response) => {
  try {
    const addons = await fetchAddons();
    res.json(addons);
  } catch (error) {
    console.error("Fehler beim Laden der Add-ons:", describeError(error));
    res.json([]);
  }
});

app.post("/api/addons/:slug/update", async (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  try {
    try {
      await supervisor.post(`/addons/${encodeURIComponent(slug)}/update`);
    } catch (_directErr) {
      await ha.post(`/api/hassio/addons/${encodeURIComponent(slug)}/update`);
    }
    logActivity("system", `Add-on Update: ${slug}`, true);
    res.json({ ok: true });
  } catch (error) {
    console.error(`Fehler beim Update von Add-on ${slug}:`, describeError(error));
    logActivity("system", `Add-on Update: ${slug}`, false, describeError(error));
    res.status(500).json({ ok: false, error: describeError(error) });
  }
});

app.get("/api/addon-info", async (_req: Request, res: Response) => {
  const version = readLocalVersion();
  try {
    let data: Record<string, unknown> = {};
    try {
      const r = await supervisor.get("/addons/self/info");
      data = r.data?.data ?? {};
    } catch (_directErr) {
      const r = await ha.get("/api/hassio/addons/self/info");
      data = r.data?.data ?? {};
    }
    res.json({
      version,
      version_latest: String(data.version_latest ?? version),
      update_available: !!data.update_available,
      name: String(data.name ?? "HA Wallpanel"),
      slug: String(data.slug ?? "wallpanel")
    });
  } catch {
    res.json({ version, version_latest: version, update_available: false, name: "HA Wallpanel", slug: "wallpanel" });
  }
});

app.get("/api/changelog", (_req: Request, res: Response) => {
  try {
    const content = fs.readFileSync(path.join(__dirname, "../wallpanel/CHANGELOG.md"), "utf8");
    res.type("text/plain").send(content);
  } catch {
    res.status(404).send("");
  }
});

app.use((_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ---------------------------------------------------------------------------
// Gate entity state-change tracking via HA WebSocket
// ---------------------------------------------------------------------------

type GateWatchEntry = {
  label: string;
  kind: ActivityEntry["kind"];
};

const GATE_WATCH: Readonly<Record<string, GateWatchEntry>> = {
  [ENTITIES.sensors.torStatus]:          { label: "Torstatus",         kind: "state"  },
  [ENTITIES.switches.smartControl]:      { label: "Smarte Steuerung",  kind: "state"  },
  [ENTITIES.switches.torAutomatik]:      { label: "Automatik",         kind: "state"  },
  [ENTITIES.switches.torDauerAuf]:       { label: "Dauerauf",          kind: "state"  },
  [ENTITIES.buttons.autoOpen]:           { label: "Automatik-Öffnen",  kind: "action" },
  [ENTITIES.binarySensors.endschalterAuf]: { label: "Endschalter Auf", kind: "state"  },
  [ENTITIES.binarySensors.endschalterZu]: { label: "Endschalter Zu",  kind: "state"  },
  [ENTITIES.binarySensors.lichtschranke]: { label: "Lichtschranke",   kind: "state"  },
  [ENTITIES.sensors.schliessZeit]:       { label: "Schließzeit",       kind: "sensor" },
  [ENTITIES.sensors.fahrZeit]:           { label: "Fahrzeit",          kind: "sensor" },
};

/** Last numeric value logged per sensor — to avoid logging every-second updates. */
const numericLastLogged: Record<string, number | null> = {};

function shouldLogNumeric(entityId: string, rawState: string): boolean {
  const val = parseFloat(rawState);
  if (!Number.isFinite(val)) return false;           // unavailable / unknown

  const last = numericLastLogged[entityId] ?? null;
  numericLastLogged[entityId] = val;

  if (last === null) return val > 0;                  // Startup: only log if already counting
  if (val === 0 && last !== 0) return true;           // Countdown reached zero
  if (val > 0 && last === 0) return true;             // Countdown started
  return Math.abs(val - last) >= 10;                  // Changed by 10+ (steps / seconds)
}

function formatTrigger(userId: string | null, origin: string): string | undefined {
  if (userId) return "Nutzer";
  if (origin === "REMOTE") return "API";
  if (origin === "LOCAL") return "Automatisierung";
  return undefined;
}

function formatGateAction(entityId: string, newState: string, label: string): string {
  // torStatus: ESP state as-is ("offen", "geschlossen", "öffnet", "schließt", …)
  if (entityId === ENTITIES.sensors.torStatus) return `${label}: ${newState}`;

  // Switches
  if (entityId === ENTITIES.switches.smartControl ||
      entityId === ENTITIES.switches.torAutomatik  ||
      entityId === ENTITIES.switches.torDauerAuf) {
    return `${label}: ${newState === "on" ? "EIN" : newState === "off" ? "AUS" : newState}`;
  }

  // Button press (autoOpen) — state is an ISO timestamp on press
  if (entityId === ENTITIES.buttons.autoOpen) return `${label}: ausgelöst`;

  // Binary sensors
  if (entityId === ENTITIES.binarySensors.endschalterAuf) {
    return newState === "on" ? "Endschalter Auf: ausgelöst" : "Endschalter Auf: freigegeben";
  }
  if (entityId === ENTITIES.binarySensors.endschalterZu) {
    return newState === "on" ? "Endschalter Zu: ausgelöst" : "Endschalter Zu: freigegeben";
  }
  if (entityId === ENTITIES.binarySensors.lichtschranke) {
    return newState === "on" ? "Lichtschranke: unterbrochen" : "Lichtschranke: frei";
  }

  // Numeric sensors
  if (entityId === ENTITIES.sensors.schliessZeit) return `${label}: ${newState} s`;
  if (entityId === ENTITIES.sensors.fahrZeit)     return `${label}: ${newState} s`;

  return `${label}: ${newState}`;
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Wallpanel läuft auf Port ${PORT}`);

  subscribeToStateChanges(
    HA_URL,
    HA_TOKEN,
    Object.keys(GATE_WATCH),
    (entityId, newState, oldState, evtCtx) => {
      const entry = GATE_WATCH[entityId];
      if (!entry) return;

      // Numeric sensors: only log on significant change
      if (entry.kind === "sensor") {
        if (!shouldLogNumeric(entityId, newState)) return;
      }

      const action  = formatGateAction(entityId, newState, entry.label);
      const trigger = formatTrigger(evtCtx.userId, evtCtx.origin);
      // context = previous state (for state entries) or current torStatus (for actions/sensors)
      const ctx = (entry.kind === "state" || entry.kind === "sensor")
        ? (oldState ?? undefined)
        : readCachedGateState();

      console.log(`[gate-watch] ${action}${trigger ? ` (${trigger})` : ""}${oldState ? ` | vorher: ${oldState}` : ""}`);
      logActivity("gate", action, true, undefined, ctx, entry.kind, trigger);
    }
  );
});
