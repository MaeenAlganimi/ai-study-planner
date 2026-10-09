import {
  SAMPLE_SYLLABUS,
  SyllabusSchema,
  TutorReplySchema,
  addDaysISO,
  formatLongDate,
  formatWeekday,
  isSampleSyllabusText,
  normalizeSyllabus,
  type Assessment,
  type Syllabus,
  type TutorReply,
  type TutorRequest,
} from "@atrium/shared";
import { extractSyllabusHeuristic } from "./heuristic";
import type { LlmProvider } from "./types";

/**
 * Deterministic provider used when GEMINI_API_KEY is unset. The bundled sample
 * syllabus returns a curated structure; any other PDF is read with the
 * heuristic extractor so demo mode does not pretend every file is CS 301.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = "mock" as const;

  async extractSyllabus(input: { text: string }): Promise<Syllabus> {
    if (isSampleSyllabusText(input.text)) return SAMPLE_SYLLABUS;
    return normalizeSyllabus(SyllabusSchema.parse(extractSyllabusHeuristic(input.text)));
  }

  async answerTutor(input: TutorRequest): Promise<TutorReply> {
    return TutorReplySchema.parse(answerFromMaterials(input));
  }
}

function answerFromMaterials(input: TutorRequest): TutorReply {
  const question = input.message.toLowerCase();
  const { syllabus, plan } = input;

  if (/office hour|room 214|when (?:is|are).{0,24}office/.test(question)) {
    const sentence = sentences(syllabus.summary).find((sentence) => /office hours/i.test(sentence));
    return {
      answer:
        sentence ??
        `The extracted notes for ${syllabus.courseCode} do not list office hours.`,
      citations: [],
    };
  }

  if (/\b(weight|weights|grade|grading|worth|percent)\b/.test(question)) {
    const lines = syllabus.assessments.map(
      (assessment) =>
        `${assessment.title} is ${assessment.weight}% on ${formatLongDate(assessment.dueDate)}`,
    );
    const total = syllabus.assessments.reduce((sum, assessment) => sum + assessment.weight, 0);
    return {
      answer: `In ${syllabus.courseCode}, ${lines.join("; ")}. The listed weights sum to ${roundWeight(total)}%.`,
      citations: syllabus.assessments.map((assessment) => assessment.title).slice(0, 8),
    };
  }

  const mentioned = syllabus.assessments.find((assessment) =>
    question.includes(assessment.title.toLowerCase()),
  );
  if (mentioned || /\b(midterm|final|quiz|exam)\b/.test(question)) {
    const assessment = mentioned ?? pickByKeyword(question, syllabus);
    if (!assessment) {
      return {
        answer: `I don't see that assessment in the ${syllabus.courseCode} syllabus.`,
        citations: [],
      };
    }
    return describeAssessment(assessment, syllabus, plan);
  }

  const topic = syllabus.topics.find((item) => question.includes(item.title.toLowerCase()));
  if (topic) {
    const usedBy = syllabus.assessments.filter((assessment) => assessment.topicIds.includes(topic.id));
    const where = usedBy.length
      ? `It is tied to ${usedBy.map((assessment) => assessment.title).join(", ")}.`
      : "No assessment in the extracted syllabus points at it directly.";
    return {
      answer: `${topic.title}${topic.weekLabel ? ` (${topic.weekLabel})` : ""}: ${topic.description ?? "Listed on the syllabus."} ${where}`,
      citations: [topic.title, ...usedBy.map((assessment) => assessment.title)].slice(0, 8),
    };
  }

  if (/\b(this week|today|tomorrow|schedule|study next|what should i study|my plan)\b/.test(question)) {
    return describeUpcoming(syllabus, plan);
  }

  return {
    answer: `I can only answer from the ${syllabus.courseCode} syllabus and your study plan. Ask what an exam covers, how the grade is weighted, or what to study next.`,
    citations: [],
  };
}

function describeAssessment(
  assessment: Assessment,
  syllabus: Syllabus,
  plan: TutorRequest["plan"],
): TutorReply {
  const topicNames = assessment.topicIds
    .map((id) => syllabus.topics.find((topic) => topic.id === id)?.title)
    .filter((title): title is string => Boolean(title));
  const sessions = (plan?.sessions ?? []).filter((session) => session.assessmentId === assessment.id);
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const scheduled = first && last
    ? `Your plan has ${sessions.length} session${sessions.length === 1 ? "" : "s"} for it, from ${formatLongDate(first.date)} through ${formatLongDate(last.date)}.`
    : "Nothing is scheduled for it on the current plan.";
  const covers =
    topicNames.length > 4
      ? `It covers ${topicNames.length} topics, from ${topicNames[0]} through ${topicNames[topicNames.length - 1]}.`
      : topicNames.length
        ? `It covers ${joinList(topicNames)}.`
        : "The syllabus does not attach specific topics to it.";
  return {
    answer: `${assessment.title} is on ${formatLongDate(assessment.dueDate)} and counts for ${assessment.weight}% of ${syllabus.courseCode}. ${covers} ${scheduled}`,
    citations: [assessment.title, ...topicNames].slice(0, 8),
  };
}

function describeUpcoming(syllabus: Syllabus, plan: TutorRequest["plan"]): TutorReply {
  const sessions = plan?.sessions ?? [];
  if (sessions.length === 0) {
    const next = [...syllabus.assessments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    return {
      answer: next
        ? `No study blocks are on the calendar. The first deadline in the syllabus is ${next.title} on ${formatLongDate(next.dueDate)}.`
        : "No study blocks are on the calendar, and the syllabus has no assessments yet.",
      citations: next ? [next.title] : [],
    };
  }
  const windowEnd = addDaysISO(plan?.startDate ?? sessions[0]!.date, 6);
  const soon = sessions.filter((session) => session.date <= windowEnd).slice(0, 5);
  const shown = soon.length > 0 ? soon : sessions.slice(0, 4);
  const lines = shown.map(
    (session) =>
      `${formatWeekday(session.date, "long")}, ${formatLongDate(session.date)}: ${session.title} (${session.durationMinutes} min)`,
  );
  return {
    answer: `Here is what the plan has coming up. ${lines.join("; ")}. ${sessions.length} sessions are scheduled in total.`,
    citations: [...new Set(shown.map((session) => session.title))].slice(0, 8),
  };
}

function pickByKeyword(question: string, syllabus: Syllabus): Assessment | undefined {
  if (question.includes("final")) {
    return syllabus.assessments.find((assessment) => /final/i.test(assessment.title));
  }
  if (question.includes("midterm")) {
    return syllabus.assessments.find((assessment) => /midterm/i.test(assessment.title));
  }
  if (question.includes("quiz")) {
    return syllabus.assessments.find((assessment) => assessment.type === "quiz");
  }
  return syllabus.assessments.find((assessment) => assessment.type === "exam" || assessment.type === "quiz");
}

function sentences(summary: string | undefined): string[] {
  if (!summary) return [];
  return summary
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function roundWeight(weight: number): number {
  return Math.round(weight * 10) / 10;
}
