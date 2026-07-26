import fs from "fs";
import path from "path";

export type PanelPageConfig = {
  id: string;
  title: string;
  areaId?: string;
  enabledCards: string[];
  enabledDevices: string[];
  enabledEntities: string[];
  hiddenEntities: string[];
};

export type PanelConfig = {
  panels: Record<string, {
    name: string;
    defaultPage: string;
    visiblePages: string[];
    pages: Record<string, PanelPageConfig>;
  }>;
};

const DEFAULT_DATA_DIR = process.env.SUPERVISOR_TOKEN ? "/data" : path.join(process.cwd(), "data");
const CONFIG_PATH = process.env.PANEL_CONFIG_PATH || path.join(process.env.DATA_DIR || DEFAULT_DATA_DIR, "panel-config.json");

const DEFAULT_CONFIG: PanelConfig = {
  panels: {
    "default": {
      name: "Standard Wallpanel",
      defaultPage: "hof",
      visiblePages: ["home", "raum", "energie", "klima", "wetter", "sicherheit"],
      pages: {
        hof: {
          id: "hof",
          title: "Hof",
          areaId: "",
          enabledCards: ["weather", "datetime", "energy"],
          enabledDevices: [],
          enabledEntities: [],
          hiddenEntities: []
        }
      }
    }
  }
};

const DEFAULT_VISIBLE_PAGES = ["home", "raum", "energie", "klima", "wetter", "sicherheit"];
function ensureConfigDir(): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cloneDefaultConfig(): PanelConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as PanelConfig;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => String(entry || "").trim())
    .filter((entry, index, list) => entry.length > 0 && list.indexOf(entry) === index);
}

function normalizePageConfig(pageId: string, page: Partial<PanelPageConfig> | null | undefined): PanelPageConfig {
  const normalized = {
    id: String(page?.id || pageId),
    title: String(page?.title || pageId),
    areaId: typeof page?.areaId === "string" ? page.areaId : "",
    enabledCards: uniqueStrings(page?.enabledCards),
    enabledDevices: uniqueStrings(page?.enabledDevices),
    enabledEntities: uniqueStrings(page?.enabledEntities),
    hiddenEntities: uniqueStrings(page?.hiddenEntities)
  };

  const hiddenSet = new Set(normalized.hiddenEntities);
  normalized.enabledEntities = normalized.enabledEntities.filter((entityId) => !hiddenSet.has(entityId));
  return normalized;
}

function normalizeVisiblePages(value: unknown): string[] {
  const pages = uniqueStrings(value);
  if (pages.length === 0) {
    return DEFAULT_VISIBLE_PAGES.slice();
  }
  const isUpgradeableConfig =
    pages.indexOf("home") !== -1 &&
    pages.indexOf("raum") !== -1 &&
    pages.indexOf("energie") !== -1 &&
    pages.indexOf("sicherheit") !== -1;

  if (isUpgradeableConfig && pages.indexOf("klima") === -1) {
    pages.splice(pages.indexOf("sicherheit"), 0, "klima");
  }
  if (isUpgradeableConfig && pages.indexOf("wetter") === -1) {
    pages.splice(pages.indexOf("sicherheit"), 0, "wetter");
  }
  return pages;
}

function normalizePanelConfig(config: Partial<PanelConfig> | null | undefined): PanelConfig {
  if (!config || typeof config !== "object" || !config.panels || typeof config.panels !== "object") {
    return cloneDefaultConfig();
  }

  const panels: PanelConfig["panels"] = {};
  for (const [panelId, panel] of Object.entries(config.panels)) {
    const sourcePanel = panel || {};
    const pages: Record<string, PanelPageConfig> = {};
    const sourcePages = sourcePanel.pages && typeof sourcePanel.pages === "object" ? sourcePanel.pages : {};
    for (const [pageId, page] of Object.entries(sourcePages)) {
      pages[pageId] = normalizePageConfig(pageId, page);
    }
    panels[panelId] = {
      name: String(sourcePanel.name || panelId),
      defaultPage: String(sourcePanel.defaultPage || "hof"),
      visiblePages: normalizeVisiblePages(sourcePanel.visiblePages),
      pages
    };
  }

  if (!panels.default) {
    panels.default = cloneDefaultConfig().panels.default;
  }
  if (!panels.default.pages.hof) {
    panels.default.pages.hof = cloneDefaultConfig().panels.default.pages.hof;
  }

  return { panels };
}

export function readPanelConfig(): PanelConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      const config = cloneDefaultConfig();
      writePanelConfig(config);
      return config;
    }

    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return normalizePanelConfig(JSON.parse(raw) as Partial<PanelConfig>);
  } catch (error) {
    console.error("Panel-Konfiguration konnte nicht gelesen werden:", error);
    return cloneDefaultConfig();
  }
}

export function writePanelConfig(config: PanelConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(normalizePanelConfig(config), null, 2), "utf8");
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
