import { AxiosInstance } from "axios";
import { Readable } from "stream";
import { HaRegistries } from "./ha-websocket";

// Live-Ansicht über go2rtc.
// Eufy-Kameras haben in go2rtc nur einen Platzhalter als Quelle (tcp://127.0.0.1:65535), bis die
// Eufy-Integration einen P2P-Livestream startet. Der Server startet ihn deshalb selbst, wartet auf
// das erste Bild und reicht den Stream als MJPEG weiter – das können auch alte iPads (iOS 9) anzeigen.

type LiveDeps = {
  ha: AxiosInstance;
  http: AxiosInstance;
  getGo2RtcBase: () => Promise<string>;
  getRegistries: () => Promise<HaRegistries>;
  describeError: (error: unknown) => string;
};

export type LiveSource = {
  streamName: string;
  isEufy: boolean;
};

const STREAMS_CACHE_MS = 30000;
const READY_TIMEOUT_MS = 25000;
const STOP_DELAY_MS = 20000;

export function createCameraLive(deps: LiveDeps) {
  let streamsCache: { at: number; names: string[] } | null = null;
  const viewers = new Map<string, number>();
  const stopTimers = new Map<string, NodeJS.Timeout>();
  const startPromises = new Map<string, Promise<boolean>>();

  async function getGo2RtcStreamNames(base: string): Promise<string[]> {
    if (streamsCache && Date.now() - streamsCache.at < STREAMS_CACHE_MS) {
      return streamsCache.names;
    }
    const response = await deps.http.get(`${base}/api/streams`, { timeout: 5000 });
    const names = response.data && typeof response.data === "object" ? Object.keys(response.data) : [];
    streamsCache = { at: Date.now(), names };
    return names;
  }

  async function resolveSource(cameraEntityId: string, streamOverride: string): Promise<LiveSource | null> {
    const base = await deps.getGo2RtcBase();
    if (!base) { return null; }

    const names = await getGo2RtcStreamNames(base);
    const registries = await deps.getRegistries().catch(() => null);
    const entity = registries?.entities.find((entry) => entry.entity_id === cameraEntityId);
    const isEufy = entity?.platform === "eufy_security";

    const shortId = cameraEntityId.replace(/^camera\./, "");
    const direct = [streamOverride, cameraEntityId, shortId].find((name) => name && names.includes(name));
    if (direct) { return { streamName: direct, isEufy }; }

    // Eufy benennt die go2rtc-Streams nach der Seriennummer des Geräts.
    const device = entity?.device_id ? registries?.devices.find((entry) => entry.id === entity.device_id) : undefined;
    const candidates = [
      device?.serial_number || "",
      ...(device?.identifiers || []).map((identifier) => identifier[1])
    ];
    const bySerial = candidates.find((name) => name && names.includes(name));
    return bySerial ? { streamName: bySerial, isEufy } : null;
  }

  async function hasFrame(base: string, streamName: string): Promise<boolean> {
    try {
      const response = await deps.http.get(`${base}/api/frame.jpeg?src=${encodeURIComponent(streamName)}`, {
        responseType: "arraybuffer",
        timeout: 8000
      });
      return Buffer.from(response.data).length > 0;
    } catch (_error) {
      return false;
    }
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function startAndWait(cameraEntityId: string, source: LiveSource, base: string): Promise<boolean> {
    if (await hasFrame(base, source.streamName)) { return true; }
    if (source.isEufy) {
      try {
        console.log(`Starte Eufy-Livestream: ${cameraEntityId} -> go2rtc-Stream ${source.streamName}`);
        await deps.ha.post("/api/services/eufy_security/start_p2p_livestream", { entity_id: cameraEntityId });
        console.log(`Eufy-Livestream angefordert (${cameraEntityId}), warte auf Bild von go2rtc …`);
      } catch (error) {
        console.warn(`Eufy-Livestream konnte nicht gestartet werden (${cameraEntityId}): ${deps.describeError(error)}`);
      }
    } else {
      console.log(`Live ${cameraEntityId} -> go2rtc-Stream ${source.streamName} (keine Eufy-Kamera, kein Startbefehl)`);
    }
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(1500);
      if (await hasFrame(base, source.streamName)) { return true; }
    }
    console.warn(`Kein Livebild von go2rtc (${source.streamName}) innerhalb von ${READY_TIMEOUT_MS / 1000}s`);
    return false;
  }

  function addViewer(cameraEntityId: string): void {
    viewers.set(cameraEntityId, (viewers.get(cameraEntityId) || 0) + 1);
    const timer = stopTimers.get(cameraEntityId);
    if (timer) {
      clearTimeout(timer);
      stopTimers.delete(cameraEntityId);
    }
  }

  function removeViewer(cameraEntityId: string, source: LiveSource): void {
    const remaining = Math.max(0, (viewers.get(cameraEntityId) || 0) - 1);
    viewers.set(cameraEntityId, remaining);
    if (remaining > 0 || !source.isEufy || stopTimers.has(cameraEntityId)) { return; }

    // Kurz warten: Beim Kamerawechsel oder Seitenneuladen kommt der Zuschauer oft gleich wieder.
    stopTimers.set(cameraEntityId, setTimeout(() => {
      stopTimers.delete(cameraEntityId);
      if ((viewers.get(cameraEntityId) || 0) > 0) { return; }
      deps.ha.post("/api/services/eufy_security/stop_p2p_livestream", { entity_id: cameraEntityId })
        .catch((error) => console.warn(`Eufy-Livestream konnte nicht gestoppt werden (${cameraEntityId}): ${deps.describeError(error)}`));
    }, STOP_DELAY_MS));
  }

  /**
   * Öffnet den MJPEG-Livestream einer Kamera über go2rtc.
   * Gibt null zurück, wenn go2rtc die Kamera nicht kennt oder kein Bild liefert.
   * `release` muss aufgerufen werden, sobald der Zuschauer weg ist.
   */
  async function openMjpeg(
    cameraEntityId: string,
    streamOverride: string
  ): Promise<{ stream: Readable; contentType: string; release: () => void } | null> {
    const base = await deps.getGo2RtcBase();
    if (!base) { return null; }
    const source = await resolveSource(cameraEntityId, streamOverride);
    if (!source) {
      console.warn(`Kein passender go2rtc-Stream für ${cameraEntityId} gefunden (go2rtc: ${base})`);
      return null;
    }

    addViewer(cameraEntityId);
    let released = false;
    const release = () => {
      if (released) { return; }
      released = true;
      removeViewer(cameraEntityId, source);
    };

    try {
      // Gleichzeitige Zuschauer (mehrere iPads) teilen sich einen Startvorgang.
      let starting = startPromises.get(cameraEntityId);
      if (!starting) {
        starting = startAndWait(cameraEntityId, source, base).finally(() => startPromises.delete(cameraEntityId));
        startPromises.set(cameraEntityId, starting);
      }
      if (!(await starting)) {
        release();
        return null;
      }

      const response = await deps.http.get(`${base}/api/stream.mjpeg?src=${encodeURIComponent(source.streamName)}`, {
        responseType: "stream",
        timeout: 15000
      });
      const contentType = response.headers["content-type"];
      return {
        stream: response.data as Readable,
        contentType: typeof contentType === "string" ? contentType : "multipart/x-mixed-replace",
        release
      };
    } catch (error) {
      console.warn(`go2rtc-Livestream nicht verfügbar (${source.streamName}): ${deps.describeError(error)}`);
      release();
      return null;
    }
  }

  async function getSourceInfo(cameraEntityId: string, streamOverride: string): Promise<LiveSource | null> {
    try {
      return await resolveSource(cameraEntityId, streamOverride);
    } catch (_error) {
      return null;
    }
  }

  return { openMjpeg, getSourceInfo };
}
