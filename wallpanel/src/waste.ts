// Tage bis zur nächsten Leerung aus einem Abfall-Sensor ermitteln.
// Die Sensoren liefern je nach Integration/Vorlage Text („in 2 Tagen“, „Morgen“, „in 3 Wochen“)
// oder ein Datum („2026-11-24“, „24.11.2026“, „Mo, 24.11.“). Für die Sortierung zählt nur die Zahl der Tage.

type WasteSensor = { state?: string; attributes?: Record<string, unknown> } | null | undefined;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Letzter Sonntag eines Monats um 01:00 UTC (Beginn/Ende der EU-Sommerzeit). */
function lastSundayUtc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 1, 0, 0));
  return lastDay.getTime() - lastDay.getUTCDay() * DAY_MS;
}

/** Heutiges Datum in deutscher Zeit als UTC-Mitternacht (unabhängig von der Zeitzone des Containers). */
function berlinToday(now: number): number {
  const year = new Date(now).getUTCFullYear();
  const summer = now >= lastSundayUtc(year, 2) && now < lastSundayUtc(year, 9);
  const local = new Date(now + (summer ? 2 : 1) * 60 * 60 * 1000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
}

function daysFromDate(year: number, month: number, day: number, today: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) { return null; }
  const target = Date.UTC(year, month - 1, day);
  const days = Math.round((target - today) / DAY_MS);
  return days >= 0 && days < 400 ? days : null;
}

function parseText(raw: string, today: number): number | null {
  const text = raw.trim().toLowerCase();
  if (!text || text === "unavailable" || text === "unknown") { return null; }
  if (/\b(heute|today)\b/.test(text)) { return 0; }
  if (/(übermorgen|uebermorgen)/.test(text)) { return 2; }
  if (/\b(morgen|tomorrow)\b/.test(text)) { return 1; }
  let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (m) { return daysFromDate(Number(m[1]), Number(m[2]), Number(m[3]), today); }
  m = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/.exec(text);
  if (m) {
    const thisYear = new Date(today).getUTCFullYear();
    let year = m[3] ? Number(m[3].length === 2 ? "20" + m[3] : m[3]) : thisYear;
    let days = daysFromDate(year, Number(m[2]), Number(m[1]), today);
    if (days === null && !m[3]) { year += 1; days = daysFromDate(year, Number(m[2]), Number(m[1]), today); }
    return days;
  }
  m = /(\d+)\s*(woche|wochen|week|weeks)\b/.exec(text);
  if (m) { return Number(m[1]) * 7; }
  m = /(\d+)\s*(tag|tage|tagen|day|days)\b/.exec(text);
  if (m) { return Number(m[1]); }
  m = /^(\d+)$/.exec(text);
  if (m) { return Number(m[1]); }
  return null;
}

/** Tage bis zur Leerung (0 = heute) oder null, wenn nicht bestimmbar. */
export function wasteDaysUntil(sensor: WasteSensor, now: number = Date.now()): number | null {
  if (!sensor) { return null; }
  const today = berlinToday(now);
  const attributes = sensor.attributes || {};
  // Zahl der Tage als Attribut (z. B. waste_collection_schedule: daysTo)
  for (const key of ["daysTo", "days_to", "daysUntil", "days_until", "days"]) {
    const value = attributes[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) { return Math.round(value); }
    if (typeof value === "string" && /^\d+$/.test(value.trim())) { return Number(value.trim()); }
  }
  // Datum als Attribut
  for (const key of ["next_date", "nextDate", "next_collection", "next_pickup", "date"]) {
    const value = attributes[key];
    if (typeof value === "string") {
      const days = parseText(value, today);
      if (days !== null) { return days; }
    }
  }
  return typeof sensor.state === "string" ? parseText(sensor.state, today) : null;
}
