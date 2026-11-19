// Gas- und Wasserverbrauch aus den Energie-Einstellungen von Home Assistant.
// Die Zähler werden dort einmal eingetragen (Einstellungen → Dashboards → Energie); das Wallpanel liest sie
// von dort, statt Sensor-Namen fest einzubauen. Neue Quellen erscheinen dadurch automatisch.

export type UtilityKind = "grid" | "solar" | "battery_in" | "battery_out" | "gas" | "water";
/** Eine Reihe im Diagramm; mehrere Zähler (z. B. zwei Solarstränge) werden zu einer Summe zusammengefasst. */
export type UtilitySource = { kind: UtilityKind; statIds: string[]; meter?: boolean };
export type DailyBucket = { start: number; change: number };
export type UtilityMetric = { id: string; label: string; display: string };
export type ChartBar = { weekday: string; day: string; value: number; label: string; today: boolean; clipped: boolean };
export type UtilityChart = { unit: string; bars: ChartBar[]; max: number };
export type UtilityGroup = { id: string; title: string; kind: UtilityKind; metrics: UtilityMetric[]; chart: UtilityChart | null; note: string };
type StateLike = { state?: string; attributes?: Record<string, unknown> } | undefined;

const DAY_MS = 24 * 60 * 60 * 1000;
// Tagesbuckets beginnen um Mitternacht deutscher Zeit, also 1–2 h vor UTC-Mitternacht des Datums.
const TOLERANCE_MS = 3 * 60 * 60 * 1000;
export const UTILITY_HISTORY_DAYS = 35;

const KIND_ORDER: UtilityKind[] = ["grid", "solar", "battery_in", "battery_out", "gas", "water"];
const TITLES: Record<UtilityKind, string> = { grid: "Strom · Netzbezug", solar: "Solar · Erzeugung", battery_in: "Akku · geladen", battery_out: "Akku · entladen", gas: "Gas", water: "Wasser" };

/** Zähler aus `energy/get_prefs`: Netzbezug, Solar, Akku, Gas und Wasser (Einspeisung wird nicht angezeigt). */
export function pickUtilitySources(prefs: unknown): UtilitySource[] {
  const list = prefs && typeof prefs === "object" ? (prefs as { energy_sources?: unknown }).energy_sources : null;
  if (!Array.isArray(list)) { return []; }
  const grouped = new Map<UtilityKind, string[]>(), separate: UtilitySource[] = [];
  const text = (value: unknown): string => (typeof value === "string" ? value : "");
  const add = (kind: UtilityKind, statId: string) => { if (statId) { const ids = grouped.get(kind) || []; if (!ids.includes(statId)) { ids.push(statId); } grouped.set(kind, ids); } };
  for (const entry of list) {
    const type = entry?.type;
    if (type === "grid") {
      // Neues Format: flow_from je Tarif; älteres: direkt am Eintrag.
      for (const flow of Array.isArray(entry.flow_from) ? entry.flow_from : []) { add("grid", text(flow?.stat_energy_from)); }
      add("grid", text(entry.stat_energy_from));
    } else if (type === "solar") { add("solar", text(entry.stat_energy_from)); }
    else if (type === "battery") { add("battery_out", text(entry.stat_energy_from)); add("battery_in", text(entry.stat_energy_to)); }
    else if ((type === "gas" || type === "water") && text(entry.stat_energy_from) && !separate.some((r) => r.statIds[0] === entry.stat_energy_from)) {
      separate.push({ kind: type, statIds: [entry.stat_energy_from] });
    }
  }
  const result: UtilitySource[] = [];
  for (const [kind, ids] of grouped) { result.push({ kind, statIds: ids }); }
  return result.concat(separate);
}

/** `recorder/statistics_during_period` (Tagesbuckets mit „change“) → sortierte Liste. */
export function parseDailyBuckets(raw: unknown, statId: string): DailyBucket[] {
  const rows = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[statId] : null;
  if (!Array.isArray(rows)) { return []; }
  const buckets: DailyBucket[] = [];
  for (const row of rows) {
    const start = typeof row?.start === "number" ? row.start : Date.parse(String(row?.start));
    const change = row?.change === null || row?.change === undefined ? NaN : Number(row.change);
    if (Number.isFinite(start) && Number.isFinite(change)) { buckets.push({ start, change }); }
  }
  return buckets.sort((a, b) => a.start - b.start);
}

export function formatNumber(value: number, unit: string): string {
  const decimals = unit === "L" || unit === "l" ? 0 : unit === "m³" ? (value < 10 ? 3 : value < 100 ? 2 : 1) : (value < 10 ? 2 : 1);
  return value.toFixed(decimals).replace(".", ",");
}

export function formatAmount(value: number, unit: string): string {
  const text = formatNumber(value, unit);
  return unit ? `${text} ${unit}` : text;
}

function pad2(n: number): string { return n < 10 ? "0" + n : String(n); }
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const CHART_DAYS = 14;

function sumSince(buckets: DailyBucket[], from: number, to: number): number {
  return buckets.filter((b) => b.start >= from && b.start < to).reduce((sum, b) => sum + b.change, 0);
}

/**
 * Grenze für Messfehler (z. B. ein Zählersprung): ab dem Vierfachen des mittleren Tageswerts. Sie gilt für Diagramm
 * und Summen gleichermaßen. Mit weniger als vier Tagen Daten wird nie gekappt.
 */
export function outlierCap(buckets: DailyBucket[]): number {
  const values = buckets.map((b) => b.change).filter((v) => v > 0).sort((x, y) => x - y);
  return values.length >= 4 ? values[Math.floor(values.length / 2)] * 4 : Infinity;
}

/** Tagesbalken der letzten 14 Tage (Tage ohne Statistik zählen als 0). Werte über `cap` werden gekappt und markiert. */
export function utilityChart(buckets: DailyBucket[], unit: string, localDay: number, cap: number = outlierCap(buckets)): UtilityChart | null {
  if (!buckets.length) { return null; }
  const bars: ChartBar[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const dayStart = localDay - i * DAY_MS;
    const value = Math.max(0, sumSince(buckets, dayStart - TOLERANCE_MS, dayStart + DAY_MS - TOLERANCE_MS));
    const date = new Date(dayStart);
    bars.push({ weekday: WEEKDAYS[date.getUTCDay()], day: String(date.getUTCDate()), value, label: formatNumber(value, unit), today: i === 0, clipped: value > cap });
  }
  return { unit, bars, max: Math.min(Math.max(...bars.map((b) => b.value)), cap) };
}

export function utilityMetrics(buckets: DailyBucket[], unit: string, meter: number | null, localDay: number): UtilityMetric[] {
  const day = new Date(localDay);
  const monthStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1);
  const metrics: UtilityMetric[] = [];
  if (buckets.length) {
    const today = sumSince(buckets, localDay - TOLERANCE_MS, Infinity);
    const yesterday = sumSince(buckets, localDay - DAY_MS - TOLERANCE_MS, localDay - TOLERANCE_MS);
    const week = sumSince(buckets, localDay - 6 * DAY_MS - TOLERANCE_MS, Infinity);
    const month = sumSince(buckets, monthStart - TOLERANCE_MS, Infinity);
    metrics.push(
      { id: "today", label: "Heute", display: formatAmount(today, unit) },
      { id: "yesterday", label: "Gestern", display: formatAmount(yesterday, unit) },
      { id: "week", label: "Letzte 7 Tage", display: formatAmount(week, unit) },
      { id: "month", label: "Dieser Monat", display: formatAmount(month, unit) }
    );
  }
  if (meter !== null && Number.isFinite(meter)) { metrics.push({ id: "meter", label: "Zählerstand", display: formatAmount(meter, unit) }); }
  return metrics;
}

/** Wh/MWh werden als kWh angezeigt; alles andere bleibt wie es ist. */
function unitOf(state: StateLike): string { return typeof state?.attributes?.unit_of_measurement === "string" ? String(state.attributes.unit_of_measurement) : ""; }
function unitFactor(unit: string): number { return unit === "Wh" ? 0.001 : unit === "MWh" ? 1000 : 1; }
function displayUnit(unit: string): string { return unit === "Wh" || unit === "MWh" ? "kWh" : unit; }

/** Tagesreihen mehrerer Zähler zu einer Summe verbinden (jeweils in die Anzeigeeinheit umgerechnet). */
function mergeBuckets(parts: Array<{ buckets: DailyBucket[]; factor: number }>): DailyBucket[] {
  const byStart = new Map<number, number>();
  for (const part of parts) { for (const b of part.buckets) { byStart.set(b.start, (byStart.get(b.start) || 0) + b.change * part.factor); } }
  return Array.from(byStart, ([start, change]) => ({ start, change })).sort((a, b) => a.start - b.start);
}


export function buildUtilityGroups(
  sources: UtilitySource[],
  bucketsByStat: Record<string, DailyBucket[]>,
  stateOf: (entityId: string) => StateLike,
  localDay: number
): UtilityGroup[] {
  const groups: UtilityGroup[] = [];
  const ordered = sources.slice().sort((x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind));
  for (const source of ordered) {
    const first = stateOf(source.statIds[0]);
    const unit = displayUnit(unitOf(first));
    const buckets = mergeBuckets(source.statIds.map((id) => ({ buckets: bucketsByStat[id] || [], factor: unitFactor(unitOf(stateOf(id))) })));
    // Zählerstand nur bei genau einem fortlaufenden Zähler (nicht bei täglich zurückgesetzten „heute“-Werten).
    const raw = Number(first?.state);
    const meter = source.meter !== false && source.statIds.length === 1 && first && first.state !== "unavailable" && first.state !== "unknown" && Number.isFinite(raw) ? raw * unitFactor(unitOf(first)) : null;
    const cap = outlierCap(buckets);
    const kept = buckets.filter((b) => b.change <= cap), dropped = buckets.filter((b) => b.change > cap);
    const metrics = utilityMetrics(kept, unit, meter, localDay);
    if (!metrics.length) { continue; }
    const same = ordered.filter((s) => s.kind === source.kind);
    const name = same.length > 1 && source.statIds.length === 1 ? String(first?.attributes?.friendly_name || source.statIds[0]) : "";
    const id = `${source.kind}:${source.statIds.join("+")}`;
    groups.push({
      id, kind: source.kind,
      chart: utilityChart(buckets, unit, localDay, cap),
      note: dropped.length ? `Ohne ${dropped.length === 1 ? "einen Messfehler" : dropped.length + " Messfehler"} (${dropped.map((b) => { const d = new Date(b.start + TOLERANCE_MS); return pad2(d.getUTCDate()) + "." + pad2(d.getUTCMonth() + 1) + "."; }).join(", ")}), ${dropped.length === 1 ? "der" : "die"} in den Summen nicht mitgezählt ${dropped.length === 1 ? "wird" : "werden"}.` : "",
      title: name ? `${TITLES[source.kind]} · ${name}` : TITLES[source.kind],
      metrics: metrics.map((m) => ({ ...m, id: `${id}:${m.id}` }))
    });
  }
  return groups;
}
