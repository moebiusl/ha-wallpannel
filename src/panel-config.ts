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
      visiblePages: ["home", "raum", "energie", "sicherheit"],
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

function ensureConfigDir(): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readPanelConfig(): PanelConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      writePanelConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }

    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as PanelConfig;
    if (!parsed.panels || typeof parsed.panels !== "object") {
      return DEFAULT_CONFIG;
    }
    return parsed;
  } catch (error) {
    console.error("Panel-Konfiguration konnte nicht gelesen werden:", error);
    return DEFAULT_CONFIG;
  }
}

export function writePanelConfig(config: PanelConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
