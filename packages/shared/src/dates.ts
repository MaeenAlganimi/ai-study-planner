const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(iso: string): boolean {
  const match = ISO_DATE.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  return formatISODate(new Date(Date.UTC(year, month - 1, day))) === iso;
}

export function parseISODate(iso: string): Date {
  if (!isValidISODate(iso)) {
    throw new Error(`Invalid calendar date: ${iso}`);
  }
  const match = ISO_DATE.exec(iso);
  if (!match) throw new Error(`Invalid calendar date: ${iso}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatISODate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

/** 0 = Sunday … 6 = Saturday, matching Date#getUTCDay. */
export function weekdayIndex(iso: string): number {
  return parseISODate(iso).getUTCDay();
}

export function startOfWeekMonday(iso: string): string {
  const day = weekdayIndex(iso);
  const delta = day === 0 ? -6 : 1 - day;
  return addDaysISO(iso, delta);
}

export function compareISODate(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function todayISO(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseISODate(iso));
}

export function formatWeekday(iso: string, style: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: style,
    timeZone: "UTC",
  }).format(parseISODate(iso));
}

export function formatClock(minutesFromMidnight: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutesFromMidnight)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  if (minutes === 0) return `${hour12} ${suffix}`;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatHours(minutes: number): string {
  const hours = Math.round(minutes / 6) / 10;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export function eachDate(start: string, end: string): string[] {
  if (end < start) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDaysISO(cursor, 1)) {
    dates.push(cursor);
    if (dates.length > 400) break;
  }
  return dates;
}
