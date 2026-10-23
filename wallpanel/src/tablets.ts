import fs from "fs";
import path from "path";
import crypto from "crypto";

// Tablet-Verwaltung: Jedes Tablet hat eine eigene Kennung (im Browser gespeichert), meldet sich
// regelmäßig per Sync und bekommt dabei seine zentral gepflegte Konfiguration und offene Befehle
// (Mitteilung, Klingel, Identifizieren, Neu laden). Konfiguriert wird vom Mac aus über die Optionen.

export type TabletConfig = {
  name?: string;
  room?: string;
  panelId?: string;
  screensaver?: { enabled: boolean; minutes: number };
  nightMode?: {
    enabled: boolean;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    brightness: number;
  };
  doorbellWake?: boolean;
  /** Töne bei Klingel und Mitteilungen abspielen (Standard: an). */
  sounds?: boolean;
};

export const SOUNDS = ["gong", "glocke", "ping", "hinweis", "alarm"] as const;

/** Gültiger Tonname, "none" für stumm, sonst der Standard. */
export function normalizeSound(value: unknown, fallback: string): string {
  const sound = String(value || "").trim().toLowerCase();
  if (sound === "none" || sound === "aus") { return "none"; }
  return (SOUNDS as readonly string[]).includes(sound) ? sound : fallback;
}

export type TabletRecord = {
  id: string;
  config: TabletConfig;
  createdAt: number;
  lastSeen: number;
  page: string;
  userAgent: string;
  ip: string;
};

export type TabletCommand = {
  type: "notify" | "doorbell" | "doorbell-close" | "identify" | "reload" | "sound";
  createdAt: number;
  title?: string;
  message?: string;
  duration?: number;
  camera?: string;
  sound?: string;
};

export type TabletsSettings = {
  doorbellEntity: string;
  doorbellCamera: string;
  /** Licht-Buttons im Klingel-Popup (leer = automatisch erkennen). */
  doorbellLights: string[];
  doorbellSound: string;
  noticeSound: string;
};

type TabletsFile = {
  tablets: Record<string, Omit<TabletRecord, "page" | "userAgent" | "ip"> & Partial<TabletRecord>>;
  settings: TabletsSettings;
};

const COMMAND_MAX_AGE_MS = 60 * 1000;
const COMMAND_QUEUE_LIMIT = 20;
const SCREENSAVER_MINUTES = [1, 2, 5, 10];

function sanitizeConfig(input: unknown): TabletConfig {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, any>;
  const config: TabletConfig = {};
  if (typeof source.name === "string") { config.name = source.name.trim().slice(0, 40); }
  if (typeof source.room === "string" && source.room) { config.room = source.room.slice(0, 80); }
  if (typeof source.panelId === "string" && source.panelId) { config.panelId = source.panelId.slice(0, 80); }
  if (source.screensaver && typeof source.screensaver === "object") {
    const minutes = Number(source.screensaver.minutes);
    config.screensaver = {
      enabled: !!source.screensaver.enabled,
      minutes: SCREENSAVER_MINUTES.includes(minutes) ? minutes : 5
    };
  }
  if (source.nightMode && typeof source.nightMode === "object") {
    const clamp = (value: unknown, min: number, max: number, fallback: number) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
    };
    config.nightMode = {
      enabled: !!source.nightMode.enabled,
      startHour: clamp(source.nightMode.startHour, 0, 23, 22),
      startMinute: clamp(source.nightMode.startMinute, 0, 59, 0),
      endHour: clamp(source.nightMode.endHour, 0, 23, 7),
      endMinute: clamp(source.nightMode.endMinute, 0, 59, 0),
      brightness: clamp(source.nightMode.brightness, 2, 50, 15)
    };
  }
  if (typeof source.doorbellWake === "boolean") { config.doorbellWake = source.doorbellWake; }
  if (typeof source.sounds === "boolean") { config.sounds = source.sounds; }
  return config;
}

/** Hash über alle Dateien in public/ – ändert sich bei jedem Update, Tablets laden dann neu. */
export function computeAssetVersion(publicDir: string): string {
  const hash = crypto.createHash("sha1");
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); }
      else { hash.update(entry.name); hash.update(fs.readFileSync(full)); }
    }
  };
  try { walk(publicDir); } catch (_error) { hash.update(String(Date.now())); }
  return hash.digest("hex").slice(0, 12);
}

export function createTabletRegistry(filePath: string, defaults: TabletsSettings) {
  const tablets = new Map<string, TabletRecord>();
  const queues = new Map<string, TabletCommand[]>();
  let settings: TabletsSettings = { ...defaults };

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as TabletsFile;
    for (const [id, record] of Object.entries(raw.tablets || {})) {
      tablets.set(id, {
        id,
        config: sanitizeConfig(record.config),
        createdAt: record.createdAt || Date.now(),
        lastSeen: record.lastSeen || 0,
        page: record.page || "",
        userAgent: record.userAgent || "",
        ip: record.ip || ""
      });
    }
    settings = { ...settings, ...(raw.settings || {}) };
    if (!Array.isArray(settings.doorbellLights)) { settings.doorbellLights = []; }
  } catch (_error) {
    // Noch keine Datei – startet leer.
  }

  let saveTimer: NodeJS.Timeout | null = null;
  function save(): void {
    // Gebündelt speichern: lastSeen ändert sich bei jedem Sync.
    if (saveTimer) { return; }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const data: TabletsFile = { tablets: Object.fromEntries(tablets), settings };
      try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      } catch (error) {
        console.error(`Tablet-Daten konnten nicht gespeichert werden: ${String(error)}`);
      }
    }, 2000);
  }

  function sync(id: string, info: { page: string; userAgent: string; ip: string; localConfig: unknown }) {
    let record = tablets.get(id);
    const isNew = !record;
    if (!record) {
      // Neues Tablet übernimmt seine bisherigen lokalen Einstellungen, damit sich nichts verstellt.
      record = { id, config: sanitizeConfig(info.localConfig), createdAt: Date.now(), lastSeen: 0, page: "", userAgent: "", ip: "" };
      tablets.set(id, record);
      console.log(`Neues Tablet registriert: ${id} (${info.userAgent.slice(0, 60)})`);
    }
    const changedInfo = isNew || record.page !== info.page || record.ip !== info.ip;
    const previousSeen = record.lastSeen;
    record.lastSeen = Date.now();
    record.page = info.page;
    record.userAgent = info.userAgent;
    record.ip = info.ip;
    if (changedInfo || record.lastSeen - previousSeen > 60000) { save(); }

    const now = Date.now();
    const commands = (queues.get(id) || []).filter((command) => now - command.createdAt < COMMAND_MAX_AGE_MS);
    queues.delete(id);
    return { config: record.config, commands };
  }

  function updateConfig(id: string, config: unknown): TabletRecord | null {
    const record = tablets.get(id);
    if (!record) { return null; }
    record.config = { ...record.config, ...sanitizeConfig(config) };
    save();
    return record;
  }

  function remove(id: string): boolean {
    queues.delete(id);
    const removed = tablets.delete(id);
    if (removed) { save(); }
    return removed;
  }

  /** Ziel: "all", Tablet-ID oder Tablet-Name (ohne Groß-/Kleinschreibung). */
  function resolveTargets(target: string | undefined): string[] {
    const wanted = String(target || "all").trim().toLowerCase();
    if (!wanted || wanted === "all" || wanted === "alle") { return Array.from(tablets.keys()); }
    return Array.from(tablets.values())
      .filter((record) => record.id.toLowerCase() === wanted || (record.config.name || "").toLowerCase() === wanted)
      .map((record) => record.id);
  }

  function enqueue(ids: string[], command: Omit<TabletCommand, "createdAt">): number {
    for (const id of ids) {
      const queue = queues.get(id) || [];
      // Tablets mit ausgeschalteten Tönen bekommen den Befehl ohne Ton (Test-Ton ausgenommen).
      const muted = tablets.get(id)?.config.sounds === false && command.type !== "sound";
      queue.push({ ...command, sound: muted ? "none" : command.sound, createdAt: Date.now() });
      queues.set(id, queue.slice(-COMMAND_QUEUE_LIMIT));
    }
    return ids.length;
  }

  function list(): TabletRecord[] {
    return Array.from(tablets.values()).sort((a, b) => (a.config.name || a.id).localeCompare(b.config.name || b.id, "de"));
  }

  function getSettings(): TabletsSettings {
    return settings;
  }

  function updateSettings(input: Partial<TabletsSettings>): TabletsSettings {
    if (typeof input.doorbellEntity === "string") { settings.doorbellEntity = input.doorbellEntity.trim(); }
    if (typeof input.doorbellCamera === "string") { settings.doorbellCamera = input.doorbellCamera.trim(); }
    if (input.doorbellSound !== undefined) { settings.doorbellSound = normalizeSound(input.doorbellSound, "gong"); }
    if (input.noticeSound !== undefined) { settings.noticeSound = normalizeSound(input.noticeSound, "ping"); }
    if (Array.isArray(input.doorbellLights)) {
      settings.doorbellLights = input.doorbellLights
        .map((entityId) => String(entityId).trim())
        .filter((entityId) => /^(light|switch)\.[\w]+$/.test(entityId))
        .slice(0, 6);
    }
    save();
    return settings;
  }

  return { sync, updateConfig, remove, resolveTargets, enqueue, list, getSettings, updateSettings };
}
