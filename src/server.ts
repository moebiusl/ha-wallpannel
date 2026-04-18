import express, { Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HA_URL = process.env.HA_URL;
const HA_TOKEN = process.env.HA_TOKEN;

if (!HA_URL || !HA_TOKEN) {
  throw new Error("HA_URL oder HA_TOKEN fehlt in der .env");
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

const ENTITIES = {
  sensors: {
    livingTemp: "sensor.smart_thermostat_valve_03008db6_temperature",
    livingHumidity: "sensor.luftbefeuchter_humidity",
    torStatus: "sensor.esp_tor_tor_status",
    schliessZeit: "sensor.esp_tor_countdown_bis_schliessung",
    fahrZeit: "sensor.esp_tor_fahrzeit_tor",
    gelbeTonneNächsteLeerung: "sensor.gelbe_tonne",
    blaueTonneNächsteLeerung: "sensor.papier_tonne",
    restmuellNächsteLeerung: "sensor.restmuell"
  },
  lights: {
    main: "light.msl320_d16d_lightbulb"
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

async function getEntity(entityId: string): Promise<HaState | null> {
  try {
    const response = await ha.get(`/api/states/${entityId}`);
    return response.data;
  } catch (error) {
    console.error(`Fehler beim Holen von ${entityId}:`, error);
    return null;
  }
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

app.get("/api/dashboard", async (_req: Request, res: Response) => {
  const [
    livingTemp,
    livingHumidity,
    kitchenLight,
    torStatus,
    smartControl,
    torAutomatik,
    torDauerAuf,
    schliessZeit,
    fahrZeit,
    gelbeTonneNächsteLeerung,
    blaueTonneNächsteLeerung,
    restmuellNächsteLeerung
  ] = await Promise.all([
    getEntity(ENTITIES.sensors.livingTemp),
    getEntity(ENTITIES.sensors.livingHumidity),
    getEntity(ENTITIES.lights.main),
    getEntity(ENTITIES.sensors.torStatus),
    getEntity(ENTITIES.switches.smartControl),
    getEntity(ENTITIES.switches.torAutomatik),
    getEntity(ENTITIES.switches.torDauerAuf),
    getEntity(ENTITIES.sensors.schliessZeit),
    getEntity(ENTITIES.sensors.fahrZeit),
    getEntity(ENTITIES.sensors.gelbeTonneNächsteLeerung),
    getEntity(ENTITIES.sensors.blaueTonneNächsteLeerung),
    getEntity(ENTITIES.sensors.restmuellNächsteLeerung)
  ]);

  const torVisual = getTorVisual(torStatus?.state);

  res.json({
    livingTemp: livingTemp?.state ?? "unavailable",
    livingHumidity: livingHumidity?.state ?? "unavailable",
    kitchenLight: kitchenLight?.state ?? "unavailable",

    torStatus: torStatus?.state ?? "unavailable",
    torVisualMode: torVisual.mode,
    torVisualText: torVisual.text,

    smartControl: isOn(smartControl?.state),
    torAutomatik: isOn(torAutomatik?.state),
    torDauerAuf: isOn(torDauerAuf?.state),
    schliessZeit: schliessZeit?.state ?? "unavailable",
    fahrZeit: fahrZeit?.state ?? "unavailable",
    gelbeTonneNächsteLeerung: gelbeTonneNächsteLeerung?.state ?? "unavailable",
    blaueTonneNächsteLeerung: blaueTonneNächsteLeerung?.state ?? "unavailable",
    restmuellNächsteLeerung: restmuellNächsteLeerung?.state ?? "unavailable",

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