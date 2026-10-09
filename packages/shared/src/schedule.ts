import { addDaysISO, eachDate, formatHours, weekdayIndex } from "./dates";
import type {
  Assessment,
  AssessmentBudget,
  Availability,
  PlanWarning,
  SessionKind,
  StudyPlan,
  StudySession,
} from "./schemas";

export interface PlanInput {
  assessments: Assessment[];
  availability: Availability;
  startDate: string;
  sessionMinutes?: number;
  dayStartHour?: number;
  /** Study time requested per grade-weight point. 30 → a 25% exam wants 12.5 hours. */
  minutesPerWeightPoint?: number;
}

const MAX_HORIZON_DAYS = 182;
const MIN_SESSION_MINUTES = 30;

interface PlacedChunk {
  date: string;
  minutes: number;
  order: number;
}

/**
 * Builds a weekly study plan without an LLM.
 *
 * Each upcoming assessment gets a minute budget from its grade weight. Sessions
 * are spread from the plan start through the last useful study day (the day
 * before an exam or quiz, or the due date for everything else), and they never
 * exceed the hours the student marked for that weekday. Nearer deadlines are
 * placed first so a midterm cannot be crowded out by a final that is months away.
 */
export function buildStudyPlan(input: PlanInput): StudyPlan {
  const sessionMinutes = input.sessionMinutes ?? 60;
  const dayStartHour = input.dayStartHour ?? 9;
  const minutesPerWeightPoint = input.minutesPerWeightPoint ?? 30;
  const warnings: PlanWarning[] = [];
  const weeklyHours = input.availability.hoursByWeekday.reduce((sum, hours) => sum + hours, 0);

  if (weeklyHours <= 0) {
    return emptyPlan(input.startDate, sessionMinutes, dayStartHour, [
      {
        code: "no-availability",
        message: "Add at least one available hour and rebuild the plan.",
      },
    ]);
  }

  const upcoming = [...input.assessments]
    .filter((assessment) => assessment.dueDate >= input.startDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.weight - a.weight);

  if (upcoming.length === 0) {
    return emptyPlan(input.startDate, sessionMinutes, dayStartHour, [
      {
        code: "nothing-upcoming",
        message: "Every assessment is already past this start date.",
      },
    ]);
  }

  const horizonEnd = addDaysISO(input.startDate, MAX_HORIZON_DAYS);
  const endDate = upcoming.reduce(
    (max, assessment) => (assessment.dueDate > max ? assessment.dueDate : max),
    upcoming[0]?.dueDate ?? input.startDate,
  );
  const cappedEnd = endDate > horizonEnd ? horizonEnd : endDate;

  const capacity = new Map<string, number>();
  for (const date of eachDate(input.startDate, cappedEnd)) {
    const hours = input.availability.hoursByWeekday[weekdayIndex(date)] ?? 0;
    capacity.set(date, Math.round(hours * 60));
  }

  const drafts: Array<{
    assessment: Assessment;
    date: string;
    minutes: number;
    kind: SessionKind;
  }> = [];
  const budgets: AssessmentBudget[] = [];

  for (const assessment of upcoming) {
    const lastDay = lastStudyDay(assessment, input.startDate);
    if (
      (assessment.type === "exam" || assessment.type === "quiz") &&
      assessment.dueDate <= input.startDate
    ) {
      warnings.push({
        code: "exam-today",
        assessmentId: assessment.id,
        message: `${assessment.title} falls on the start date, so there is no earlier day to study.`,
      });
    }

    const effectiveLast = lastDay > cappedEnd ? cappedEnd : lastDay;
    const dates = [...capacity.keys()]
      .filter((date) => date >= input.startDate && date <= effectiveLast && (capacity.get(date) ?? 0) >= MIN_SESSION_MINUTES)
      .sort();
    const available = dates.reduce((sum, date) => sum + (capacity.get(date) ?? 0), 0);
    const target = assessment.weight > 0 ? Math.round(assessment.weight * minutesPerWeightPoint) : 0;
    const goal = Math.min(target, available);
    const parts = splitMinutes(goal, sessionMinutes);
    const placed = placeParts(parts, dates, capacity);
    const ordered = [...placed].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    const kinds = assignKinds(ordered.length);

    ordered.forEach((chunk, index) => {
      const kind = kinds[index] ?? "review";
      drafts.push({
        assessment,
        date: chunk.date,
        minutes: chunk.minutes,
        kind,
      });
    });

    const scheduledMinutes = ordered.reduce((sum, chunk) => sum + chunk.minutes, 0);
    budgets.push({
      assessmentId: assessment.id,
      targetMinutes: target,
      scheduledMinutes,
    });

    if (target >= MIN_SESSION_MINUTES && scheduledMinutes + 15 < target) {
      warnings.push({
        code: "short-budget",
        assessmentId: assessment.id,
        message: `${assessment.title} has ${formatHours(available)} free before it is due, short of the ${formatHours(target)} this weight usually needs.`,
      });
    }
  }

  const sessions = assignStartTimes(drafts, dayStartHour);
  return {
    id: `plan-${input.startDate}`,
    startDate: input.startDate,
    sessionMinutes,
    dayStartHour,
    sessions,
    warnings,
    budgets,
  };
}

export function splitMinutes(total: number, sessionMinutes: number): number[] {
  const size = Math.max(MIN_SESSION_MINUTES, Math.round(sessionMinutes));
  const parts: number[] = [];
  let left = Math.round(total);
  if (left < MIN_SESSION_MINUTES) return parts;

  while (left >= MIN_SESSION_MINUTES) {
    if (left <= size) {
      parts.push(left);
      break;
    }
    if (left - size < MIN_SESSION_MINUTES) {
      const first = left - MIN_SESSION_MINUTES;
      if (first >= MIN_SESSION_MINUTES) {
        parts.push(first);
        parts.push(MIN_SESSION_MINUTES);
      } else {
        parts.push(left);
      }
      break;
    }
    parts.push(size);
    left -= size;
  }
  return parts;
}

function placeParts(
  parts: number[],
  dates: string[],
  capacity: Map<string, number>,
): PlacedChunk[] {
  if (dates.length === 0) return [];
  const placed: PlacedChunk[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const minutes = parts[index] ?? 0;
    const t = parts.length === 1 ? 0.75 : index / (parts.length - 1);
    const ideal = t * (dates.length - 1);
    let best: string | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    dates.forEach((date, dateIndex) => {
      if ((capacity.get(date) ?? 0) < minutes) return;
      const distance = Math.abs(dateIndex - ideal);
      const tie = t >= 0.5 ? -dateIndex : dateIndex;
      const score = distance * 1000 + tie;
      if (score < bestScore) {
        bestScore = score;
        best = date;
      }
    });

    if (!best) break;
    capacity.set(best, (capacity.get(best) ?? 0) - minutes);
    placed.push({ date: best, minutes, order: index });
  }

  return placed;
}

function assignKinds(count: number): SessionKind[] {
  return Array.from({ length: count }, (_, index) => {
    const frac = (index + 1) / count;
    if (count === 1 || frac <= 0.5) return "learn";
    if (frac <= 0.8) return "practice";
    return "review";
  });
}

function assignStartTimes(
  drafts: Array<{ assessment: Assessment; date: string; minutes: number; kind: SessionKind }>,
  dayStartHour: number,
): StudySession[] {
  const byDate = new Map<string, typeof drafts>();
  for (const draft of drafts) {
    const list = byDate.get(draft.date) ?? [];
    list.push(draft);
    byDate.set(draft.date, list);
  }

  const kindOrder: Record<SessionKind, number> = { learn: 0, practice: 1, review: 2 };
  const counters = new Map<string, number>();
  const sessions: StudySession[] = [];

  for (const date of [...byDate.keys()].sort()) {
    const list = byDate.get(date) ?? [];
    list.sort(
      (a, b) =>
        a.assessment.dueDate.localeCompare(b.assessment.dueDate) ||
        kindOrder[a.kind] - kindOrder[b.kind] ||
        a.assessment.title.localeCompare(b.assessment.title),
    );
    let cursor = dayStartHour * 60;
    for (const item of list) {
      const next = (counters.get(item.assessment.id) ?? 0) + 1;
      counters.set(item.assessment.id, next);
      sessions.push({
        id: `${item.assessment.id}-${next}`,
        date,
        startMinutes: cursor,
        durationMinutes: item.minutes,
        assessmentId: item.assessment.id,
        title: sessionTitle(item.kind, item.assessment.title),
        kind: item.kind,
        topicIds: item.assessment.topicIds,
      });
      cursor += item.minutes;
    }
  }

  return sessions;
}

function sessionTitle(kind: SessionKind, assessmentTitle: string): string {
  const label = kind === "learn" ? "Learn" : kind === "practice" ? "Practice" : "Review";
  return `${label} · ${assessmentTitle}`;
}

function lastStudyDay(assessment: Assessment, startDate: string): string {
  if (assessment.type === "exam" || assessment.type === "quiz") {
    const previous = addDaysISO(assessment.dueDate, -1);
    return previous < startDate ? startDate : previous;
  }
  return assessment.dueDate < startDate ? startDate : assessment.dueDate;
}

function emptyPlan(
  startDate: string,
  sessionMinutes: number,
  dayStartHour: number,
  warnings: PlanWarning[],
): StudyPlan {
  return {
    id: `plan-${startDate}`,
    startDate,
    sessionMinutes,
    dayStartHour,
    sessions: [],
    warnings,
    budgets: [],
  };
}
