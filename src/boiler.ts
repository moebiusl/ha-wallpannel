// Boiler: welche HA-Entität schaltet ihn ein, und wann war er zuletzt an.
// Der Timer (timer.boiler_timer_10min) zählt nur die Laufzeit; eingeschaltet wird über eine
// Szene/ein Skript (bevorzugt, „wie eine Szene“) oder einen Schalter/Helfer.

type State = { entity_id: string; state: string; last_changed?: string; attributes?: Record<string, unknown> };
type HistoryEntry = { state?: string; last_changed?: string };

export const BOILER_TIMER = "timer.boiler_timer_10min";

/** Reihenfolge: Szene/Skript zuerst (kapseln Einschalten + Timer), dann Schalter und Helfer. */
const DOMAIN_PRIORITY = ["scene", "script", "switch", "input_boolean", "light"];
const NAME_PATTERN = /(boiler|warmwasser|warm_wasser|durchlauferhitzer)/i;

export type BoilerEntity = { entityId: string; name: string; domain: string };

function describe(state: State): BoilerEntity {
  const domain = state.entity_id.split(".")[0];
  return { entityId: state.entity_id, name: String(state.attributes?.friendly_name || state.entity_id), domain };
}

/** Alle Entitäten, die als Boiler-Schalter in Frage kommen (für die Auswahl in den Optionen). */
export function boilerCandidates(states: State[]): BoilerEntity[] {
  return states
    .filter((state) => DOMAIN_PRIORITY.includes(state.entity_id.split(".")[0]))
    .filter((state) => NAME_PATTERN.test(state.entity_id) || NAME_PATTERN.test(String(state.attributes?.friendly_name || "")))
    .map(describe)
    .sort((a, b) => DOMAIN_PRIORITY.indexOf(a.domain) - DOMAIN_PRIORITY.indexOf(b.domain) || a.entityId.length - b.entityId.length);
}

/** Eingestellte Entität (falls vorhanden), sonst die beste automatisch erkannte. */
export function chooseBoilerEntity(states: State[], configured: string): BoilerEntity | null {
  if (configured) {
    const match = states.find((state) => state.entity_id === configured);
    if (match) { return describe(match); }
  }
  return boilerCandidates(states)[0] || null;
}

function validTime(value: unknown): string | null {
  if (typeof value !== "string" || !value) { return null; }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** „Zuletzt an“ direkt aus dem aktuellen Zustand, wo das ohne Verlauf geht. */
export function lastOnFromState(state: State | null | undefined): string | null {
  if (!state) { return null; }
  const domain = state.entity_id.split(".")[0];
  if (domain === "scene") { return validTime(state.state); }               // Zustand = letzte Aktivierung
  if (domain === "script") { return validTime(state.attributes?.last_triggered); }
  if (state.state === "on") { return validTime(state.last_changed); }      // läuft gerade: seit wann
  return null;
}

/** Letzter Wechsel in einen „an“-Zustand aus dem HA-Verlauf (on bzw. active beim Timer). */
export function lastOnFromHistory(history: HistoryEntry[] | null | undefined, onStates: string[] = ["on", "active"]): string | null {
  if (!Array.isArray(history)) { return null; }
  let latest: string | null = null;
  for (const entry of history) {
    if (entry && typeof entry.state === "string" && onStates.includes(entry.state)) {
      const time = validTime(entry.last_changed);
      if (time && (!latest || time > latest)) { latest = time; }
    }
  }
  return latest;
}
