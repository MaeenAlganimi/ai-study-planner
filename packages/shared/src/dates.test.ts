import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  formatClock,
  isValidISODate,
  startOfWeekMonday,
  weekdayIndex,
} from "./dates";

describe("dates", () => {
  it("rejects impossible calendar dates", () => {
    expect(isValidISODate("2026-02-31")).toBe(false);
    expect(isValidISODate("2026-10-09")).toBe(true);
    expect(isValidISODate("10/09/2026")).toBe(false);
  });

  it("adds days across month boundaries in UTC", () => {
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-10-09", -1)).toBe("2026-10-08");
  });

  it("treats Monday as the start of the week", () => {
    expect(weekdayIndex("2026-10-09")).toBe(5);
    expect(startOfWeekMonday("2026-10-09")).toBe("2026-10-05");
    expect(startOfWeekMonday("2026-10-11")).toBe("2026-10-05");
    expect(startOfWeekMonday("2026-10-12")).toBe("2026-10-12");
  });

  it("formats study-block clocks without a date library", () => {
    expect(formatClock(9 * 60)).toBe("9 AM");
    expect(formatClock(13 * 60 + 30)).toBe("1:30 PM");
    expect(formatClock(0)).toBe("12 AM");
  });
});
