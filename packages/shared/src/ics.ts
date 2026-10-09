import type { StudySession } from "./schemas";

export interface CalendarInput {
  calendarName: string;
  courseCode?: string;
  sessions: StudySession[];
  createdAt?: Date;
}

/**
 * Builds an iCalendar document with floating local times so a 9:00 study block
 * stays at 9:00 on the student's calendar, regardless of the server timezone.
 */
export function sessionsToIcs(input: CalendarInput): string {
  const stamp = formatUtcStamp(input.createdAt ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atrium//Study Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.calendarName)}`,
  ];

  for (const session of input.sessions) {
    const uid = `${session.id}@atrium.study`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toFloating(session.date, session.startMinutes)}`,
      `DTEND:${toFloating(session.date, session.startMinutes + session.durationMinutes)}`,
      `SUMMARY:${escapeText(session.title)}`,
      `DESCRIPTION:${escapeText(describeSession(session, input.courseCode))}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

function describeSession(session: StudySession, courseCode?: string): string {
  const hours = session.durationMinutes / 60;
  const prefix = courseCode ? `${courseCode}. ` : "";
  return `${prefix}${session.kind} session, ${hours}h.`;
}

function toFloating(isoDate: string, minutesFromMidnight: number): string {
  const dayCarry = Math.floor(minutesFromMidnight / (24 * 60));
  const minutes = minutesFromMidnight - dayCarry * 24 * 60;
  const date = addDays(isoDate, dayCarry);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const compact = date.replaceAll("-", "");
  return `${compact}T${String(hours).padStart(2, "0")}${String(mins).padStart(2, "0")}00`;
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatUtcStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

export function escapeText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

/** RFC 5545 line folding at 75 octets. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  const limit = 75;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const max = parts.length === 0 ? limit : limit - 1;
    if (current && currentBytes + bytes > max) {
      parts.push(current);
      current = char;
      currentBytes = bytes;
    } else {
      current += char;
      currentBytes += bytes;
    }
  }
  if (current) parts.push(current);
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join("\r\n");
}
