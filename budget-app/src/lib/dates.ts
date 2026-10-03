export const MONTHS_AZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];
export const WEEKDAYS_AZ = [
  "Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə",
  "Cümə axşamı", "Cümə", "Şənbə",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Cihazın yerli tarixi, YYYY-MM-DD */
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday };
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** "3 Oktyabr 2026" */
export function formatDateLong(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS_AZ[m - 1]} ${y}`;
}

/** Siyahı başlığı: "Bu gün", "Dünən", "3 Oktyabr 2026, Cümə" */
export function formatDayHeading(iso: string, today: string = todayISO()): string {
  if (iso === today) return "Bu gün";
  if (iso === addDays(today, -1)) return "Dünən";
  const { weekday } = parts(iso);
  return `${formatDateLong(iso)}, ${WEEKDAYS_AZ[weekday]}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return `${MONTHS_AZ[m - 1]} ${y}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}
