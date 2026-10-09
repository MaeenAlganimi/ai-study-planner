import { describe, expect, it } from "vitest";
import { weekdayIndex } from "./dates";
import { DEFAULT_AVAILABILITY, type Assessment, type Availability } from "./schemas";
import { buildStudyPlan, splitMinutes } from "./schedule";

const FULL_DAYS: Availability = {
  hoursByWeekday: [8, 8, 8, 8, 8, 8, 8],
};

function assessment(overrides: Partial<Assessment> & Pick<Assessment, "id" | "dueDate" | "weight">): Assessment {
  return {
    title: overrides.id,
    type: "assignment",
    topicIds: [],
    ...overrides,
  };
}

describe("splitMinutes", () => {
  it("keeps a short leftover instead of a tiny fragment", () => {
    expect(splitMinutes(100, 60)).toEqual([60, 40]);
    expect(splitMinutes(70, 60)).toEqual([40, 30]);
    expect(splitMinutes(20, 60)).toEqual([]);
  });
});

describe("buildStudyPlan", () => {
  it("gives a heavier assessment more time when both fit", () => {
    const plan = buildStudyPlan({
      assessments: [
        assessment({ id: "heavy", title: "Heavy", dueDate: "2026-12-01", weight: 20 }),
        assessment({ id: "light", title: "Light", dueDate: "2026-12-01", weight: 10 }),
      ],
      availability: FULL_DAYS,
      startDate: "2026-10-09",
      sessionMinutes: 60,
      minutesPerWeightPoint: 60,
    });

    const heavy = plan.budgets.find((budget) => budget.assessmentId === "heavy");
    const light = plan.budgets.find((budget) => budget.assessmentId === "light");
    expect(heavy?.scheduledMinutes).toBe(20 * 60);
    expect(light?.scheduledMinutes).toBe(10 * 60);
    expect(heavy!.scheduledMinutes).toBe(light!.scheduledMinutes * 2);
  });

  it("does not schedule an exam on the exam day when earlier days exist", () => {
    const plan = buildStudyPlan({
      assessments: [
        assessment({
          id: "midterm",
          title: "Midterm",
          type: "exam",
          dueDate: "2026-10-22",
          weight: 25,
        }),
      ],
      availability: FULL_DAYS,
      startDate: "2026-10-09",
      sessionMinutes: 60,
      minutesPerWeightPoint: 30,
    });

    expect(plan.sessions.length).toBeGreaterThan(0);
    expect(plan.sessions.every((session) => session.date < "2026-10-22")).toBe(true);
  });

  it("allows an assignment on its due date", () => {
    const plan = buildStudyPlan({
      assessments: [
        assessment({ id: "pset", title: "Problem set", dueDate: "2026-10-14", weight: 10 }),
      ],
      availability: { hoursByWeekday: [0, 0, 0, 2, 0, 0, 0] },
      startDate: "2026-10-14",
      sessionMinutes: 60,
      minutesPerWeightPoint: 30,
    });

    expect(plan.sessions.map((session) => session.date)).toEqual(["2026-10-14", "2026-10-14"]);
    expect(plan.sessions.reduce((sum, session) => sum + session.durationMinutes, 0)).toBe(120);
  });

  it("never exceeds the hours marked for a weekday", () => {
    const availability = DEFAULT_AVAILABILITY;
    const plan = buildStudyPlan({
      assessments: [
        assessment({ id: "midterm", title: "Midterm", type: "exam", dueDate: "2026-10-22", weight: 40 }),
        assessment({ id: "final", title: "Final", type: "exam", dueDate: "2026-12-10", weight: 40 }),
      ],
      availability,
      startDate: "2026-10-09",
      minutesPerWeightPoint: 60,
    });

    const byDate = new Map<string, number>();
    for (const session of plan.sessions) {
      byDate.set(session.date, (byDate.get(session.date) ?? 0) + session.durationMinutes);
    }
    for (const [date, minutes] of byDate) {
      const cap = Math.round((availability.hoursByWeekday[weekdayIndex(date)] ?? 0) * 60);
      expect(minutes).toBeLessThanOrEqual(cap);
    }
  });

  it("stacks blocks on a day without overlapping clocks", () => {
    const plan = buildStudyPlan({
      assessments: [assessment({ id: "pset", title: "Problem set", dueDate: "2026-10-12", weight: 8 })],
      availability: { hoursByWeekday: [0, 3, 0, 0, 0, 0, 0] },
      startDate: "2026-10-12",
      dayStartHour: 9,
      sessionMinutes: 60,
      minutesPerWeightPoint: 30,
    });

    expect(plan.sessions.map((session) => [session.startMinutes, session.durationMinutes])).toEqual([
      [9 * 60, 60],
      [10 * 60, 60],
      [11 * 60, 60],
    ]);
  });

  it("puts review sessions on a later day than learn sessions when there is room", () => {
    const plan = buildStudyPlan({
      assessments: [
        assessment({
          id: "midterm",
          title: "Midterm",
          type: "exam",
          dueDate: "2026-10-22",
          weight: 25,
        }),
      ],
      availability: FULL_DAYS,
      startDate: "2026-10-09",
      sessionMinutes: 60,
      minutesPerWeightPoint: 30,
    });

    const learnDates = plan.sessions.filter((session) => session.kind === "learn").map((session) => session.date);
    const reviewDates = plan.sessions.filter((session) => session.kind === "review").map((session) => session.date);
    expect(learnDates.length).toBeGreaterThan(0);
    expect(reviewDates.length).toBeGreaterThan(0);
    expect(reviewDates[reviewDates.length - 1]! >= learnDates[0]!).toBe(true);
    expect(reviewDates.every((date) => date >= learnDates[learnDates.length - 1]!)).toBe(true);
  });

  it("returns no sessions when every weekday is closed", () => {
    const plan = buildStudyPlan({
      assessments: [assessment({ id: "final", title: "Final", type: "exam", dueDate: "2026-12-10", weight: 25 })],
      availability: { hoursByWeekday: [0, 0, 0, 0, 0, 0, 0] },
      startDate: "2026-10-09",
    });
    expect(plan.sessions).toEqual([]);
    expect(plan.warnings.map((warning) => warning.code)).toContain("no-availability");
  });

  it("skips assessments that are already past the start date", () => {
    const plan = buildStudyPlan({
      assessments: [
        assessment({ id: "old", title: "Old", dueDate: "2026-09-12", weight: 20 }),
        assessment({ id: "next", title: "Next", dueDate: "2026-10-20", weight: 10 }),
      ],
      availability: FULL_DAYS,
      startDate: "2026-10-09",
      minutesPerWeightPoint: 30,
    });
    expect(plan.budgets.map((budget) => budget.assessmentId)).toEqual(["next"]);
    expect(plan.sessions.every((session) => session.assessmentId === "next")).toBe(true);
  });

  it("only uses weekend days when those are the available hours", () => {
    const plan = buildStudyPlan({
      assessments: [assessment({ id: "final", title: "Final", type: "exam", dueDate: "2026-11-02", weight: 10 })],
      availability: { hoursByWeekday: [3, 0, 0, 0, 0, 0, 3] },
      startDate: "2026-10-09",
      sessionMinutes: 60,
      minutesPerWeightPoint: 30,
    });
    expect(plan.sessions.length).toBeGreaterThan(0);
    expect(plan.sessions.every((session) => [0, 6].includes(weekdayIndex(session.date)))).toBe(true);
  });

  it("is deterministic", () => {
    const input = {
      assessments: [
        assessment({ id: "midterm", title: "Midterm", type: "exam" as const, dueDate: "2026-10-22", weight: 25 }),
        assessment({ id: "project", title: "Project", type: "project" as const, dueDate: "2026-11-20", weight: 16 }),
      ],
      availability: DEFAULT_AVAILABILITY,
      startDate: "2026-10-09",
    };
    expect(buildStudyPlan(input)).toEqual(buildStudyPlan(input));
  });

  it("warns when the deadline leaves less time than the weight asks for", () => {
    const plan = buildStudyPlan({
      assessments: [
        assessment({ id: "midterm", title: "Midterm", type: "exam", dueDate: "2026-10-11", weight: 25 }),
      ],
      availability: { hoursByWeekday: [0, 0, 0, 0, 0, 1, 1] },
      startDate: "2026-10-09",
      minutesPerWeightPoint: 60,
    });
    expect(plan.warnings.some((warning) => warning.code === "short-budget")).toBe(true);
    const scheduled = plan.sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    expect(scheduled).toBeLessThan(25 * 60);
    expect(scheduled).toBeGreaterThan(0);
  });
});
