import { describe, expect, it } from "vitest";
import { escapeText, foldLine, sessionsToIcs } from "./ics";
import type { StudySession } from "./schemas";

const session: StudySession = {
  id: "midterm-1",
  date: "2026-10-12",
  startMinutes: 9 * 60,
  durationMinutes: 90,
  assessmentId: "midterm",
  title: "Learn · Midterm, trees",
  kind: "learn",
  topicIds: ["trees"],
};

describe("sessionsToIcs", () => {
  it("writes one event with floating local times", () => {
    const ics = sessionsToIcs({
      calendarName: "Atrium · CS 301",
      courseCode: "CS 301",
      sessions: [session],
      createdAt: new Date("2026-10-09T15:04:05Z"),
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261012T090000");
    expect(ics).toContain("DTEND:20261012T103000");
    expect(ics).toContain("DTSTAMP:20261009T150405Z");
    expect(ics).toContain("UID:midterm-1@atrium.study");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("escapes commas, semicolons, and newlines", () => {
    expect(escapeText("Learn · Midterm, trees")).toBe("Learn · Midterm\\, trees");
    expect(escapeText("a;b\nc")).toBe("a\\;b\\nc");
    const ics = sessionsToIcs({
      calendarName: "Atrium",
      sessions: [session],
      createdAt: new Date("2026-10-09T00:00:00Z"),
    });
    expect(ics).toContain("SUMMARY:Learn · Midterm\\, trees");
  });

  it("folds lines longer than 75 octets", () => {
    const folded = foldLine(`DESCRIPTION:${"A".repeat(90)}`);
    const [first, second] = folded.split("\r\n");
    expect(first?.length).toBeLessThanOrEqual(75);
    expect(second?.startsWith(" ")).toBe(true);
  });
});
