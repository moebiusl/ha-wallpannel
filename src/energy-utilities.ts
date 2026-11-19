// Gas- und Wasserverbrauch aus den Energie-Einstellungen von Home Assistant.
// Die Zähler werden dort einmal eingetragen (Einstellungen → Dashboards → Energie); das Wallpanel liest sie
// von dort, statt Sensor-Namen fest einzubauen. Neue Quellen erscheinen dadurch automatisch.

export type UtilityKind = "gas" | "water";
export type UtilitySource = { kind: UtilityKind; statId: string };
export type DailyBucket = { start: number; change: number };
export type UtilityMetric = { id: string; label: string; display: string };
export type UtilityGroup = { id: string; title: string; metrics: UtilityMetric[] };
type StateLike = { state?: string; attributes?: Record<string, unknown> } | undefined;

const DAY_MS = 24 * 60 * 60 * 1000;
// Tagesbuckets beginnen um Mitternacht deutscher Zeit, also 1–2 h vor UTC-Mitternacht des Datums.
const TOLERANCE_MS = 3 * 60 * 60 * 1000;
export const UTILITY_HISTORY_DAYS = 35;

/** Gas- und Wasserzähler aus `energy/get_prefs`. */
export function pickUtilitySources(prefs: unknown): UtilitySource[] {
  const list = prefs && typeof prefs === "object" ? (prefs as { energy_sources?: unknown }).energy_sources : null;
  if (!Array.isArray(list)) { return []; }
  const result: UtilitySource[] = [];
  for (const entry of list) {
    const type = entry?.type;
    const statId = entry?.stat_energy_from;
    if ((type === "gas" || type === "water") && typeof statId === "string" && statId && !result.some((r) => r.statId === statId)) {
      result.push({ kind: type, statId });
    }
  }
  return result;
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

export function formatAmount(value: number, unit: string): string {
  const decimals = unit === "L" || unit === "l" ? 0 : unit === "m³" ? (value < 10 ? 3 : value < 100 ? 2 : 1) : (value < 10 ? 2 : 1);
  const text = value.toFixed(decimals).replace(".", ",");
  return unit ? `${text} ${unit}` : text;
}

function sumSince(buckets: DailyBucket[], from: number, to: number): number {
  return buckets.filter((b) => b.start >= from && b.start < to).reduce((sum, b) => sum + b.change, 0);
}

/**
 * Metriken für einen Zähler. `localDay` ist das heutige Datum (deutsche Zeit) als UTC-Mitternacht,
 * wie es `berlinToday()` liefert.
 */
export function utilityMetrics(buckets: DailyBucket[], state: StateLike, localDay: number): UtilityMetric[] {
  const unit = typeof state?.attributes?.unit_of_measurement === "string" ? String(state?.attributes?.unit_of_measurement) : "";
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
  const meter = Number(state?.state);
  if (state && state.state !== "unavailable" && state.state !== "unknown" && Number.isFinite(meter)) {
    metrics.push({ id: "meter", label: "Zählerstand", display: formatAmount(meter, unit) });
  }
  return metrics;
}

const TITLES: Record<UtilityKind, string> = { gas: "Gas", water: "Wasser" };

export function buildUtilityGroups(
  sources: UtilitySource[],
  bucketsByStat: Record<string, DailyBucket[]>,
  stateOf: (entityId: string) => StateLike,
  localDay: number
): UtilityGroup[] {
  const groups: UtilityGroup[] = [];
  for (const source of sources) {
    const metrics = utilityMetrics(bucketsByStat[source.statId] || [], stateOf(source.statId), localDay);
    if (!metrics.length) { continue; }
    const same = sources.filter((s) => s.kind === source.kind);
    const name = same.length > 1 ? String(stateOf(source.statId)?.attributes?.friendly_name || source.statId) : "";
    groups.push({
      id: `${source.kind}:${source.statId}`,
      title: name ? `${TITLES[source.kind]} · ${name}` : TITLES[source.kind],
      metrics: metrics.map((m) => ({ ...m, id: `${source.statId}:${m.id}` }))
    });
  }
  return groups;
}
