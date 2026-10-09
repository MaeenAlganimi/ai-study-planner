import { z } from "zod";
import { isValidISODate } from "./dates";

const isoDate = z.string().refine(isValidISODate, "Use a real YYYY-MM-DD date.");

export const TopicSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(600).optional(),
  weekLabel: z.string().trim().max(40).optional(),
});

export const AssessmentTypeSchema = z.enum([
  "exam",
  "quiz",
  "assignment",
  "project",
  "reading",
  "other",
]);

export const AssessmentSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  type: AssessmentTypeSchema,
  dueDate: isoDate,
  weight: z.number().min(0).max(100),
  topicIds: z.array(z.string().trim().min(1).max(80)).max(40),
});

export const SyllabusSchema = z.object({
  courseCode: z.string().trim().min(1).max(40),
  courseTitle: z.string().trim().min(1).max(160),
  instructor: z.string().trim().max(120).optional(),
  term: z.string().trim().max(40).optional(),
  summary: z.string().trim().max(2000).optional(),
  topics: z.array(TopicSchema).max(80),
  assessments: z.array(AssessmentSchema).max(40),
});

export const AvailabilitySchema = z.object({
  hoursByWeekday: z.array(z.number().min(0).max(12)).length(7),
});

export const SessionKindSchema = z.enum(["learn", "practice", "review"]);

export const StudySessionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  date: isoDate,
  startMinutes: z.number().int().min(0).max(24 * 60),
  durationMinutes: z.number().int().min(15).max(240),
  assessmentId: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(180),
  kind: SessionKindSchema,
  topicIds: z.array(z.string()).max(40),
});

export const PlanWarningSchema = z.object({
  code: z.enum(["no-availability", "nothing-upcoming", "short-budget", "exam-today"]),
  message: z.string().min(1).max(400),
  assessmentId: z.string().max(80).optional(),
});

export const BudgetSchema = z.object({
  assessmentId: z.string(),
  targetMinutes: z.number().int().min(0),
  scheduledMinutes: z.number().int().min(0),
});

export const StudyPlanSchema = z.object({
  id: z.string().min(1).max(80),
  startDate: isoDate,
  sessionMinutes: z.number().int().min(30).max(180),
  dayStartHour: z.number().int().min(6).max(18),
  sessions: z.array(StudySessionSchema).max(500),
  warnings: z.array(PlanWarningSchema).max(80),
  budgets: z.array(BudgetSchema).max(40),
});

export const PlanRequestSchema = z.object({
  syllabus: SyllabusSchema,
  availability: AvailabilitySchema,
  startDate: isoDate,
  sessionMinutes: z.number().int().min(30).max(180).default(60),
  dayStartHour: z.number().int().min(6).max(18).default(9),
  minutesPerWeightPoint: z.number().int().min(10).max(120).default(30),
});

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const TutorRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  syllabus: SyllabusSchema,
  plan: StudyPlanSchema.nullable(),
  history: z.array(ChatMessageSchema).max(12).default([]),
});

export const TutorReplySchema = z.object({
  answer: z.string().trim().min(1).max(4000),
  citations: z.array(z.string().trim().min(1).max(160)).max(8),
});

export type Topic = z.infer<typeof TopicSchema>;
export type AssessmentType = z.infer<typeof AssessmentTypeSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type Syllabus = z.infer<typeof SyllabusSchema>;
export type Availability = z.infer<typeof AvailabilitySchema>;
export type SessionKind = z.infer<typeof SessionKindSchema>;
export type StudySession = z.infer<typeof StudySessionSchema>;
export type PlanWarning = z.infer<typeof PlanWarningSchema>;
export type AssessmentBudget = z.infer<typeof BudgetSchema>;
export type StudyPlan = z.infer<typeof StudyPlanSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type TutorRequest = z.infer<typeof TutorRequestSchema>;
export type TutorReply = z.infer<typeof TutorReplySchema>;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const WEEKDAY_LABELS_SUNDAY_FIRST = WEEKDAY_LABELS;

export const DEFAULT_AVAILABILITY: Availability = {
  hoursByWeekday: [1.5, 2, 2, 2, 2, 1, 2.5],
};

export function slugId(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

export function normalizeSyllabus(input: Syllabus): Syllabus {
  const seenTopics = new Set<string>();
  const topics = input.topics.map((topic, index) => {
    let id = slugId(topic.id, `topic-${index + 1}`);
    while (seenTopics.has(id)) id = `${id}-${index + 1}`;
    seenTopics.add(id);
    return {
      ...topic,
      id,
      title: topic.title.trim(),
    };
  });
  const topicIds = new Set(topics.map((topic) => topic.id));
  const seenAssessments = new Set<string>();
  const assessments = input.assessments.map((assessment, index) => {
    let id = slugId(assessment.id, `assessment-${index + 1}`);
    while (seenAssessments.has(id)) id = `${id}-${index + 1}`;
    seenAssessments.add(id);
    return {
      ...assessment,
      id,
      title: assessment.title.trim(),
      weight: Math.round(assessment.weight * 10) / 10,
      topicIds: assessment.topicIds.filter((topicId) => topicIds.has(topicId)),
    };
  });

  return {
    ...input,
    courseCode: input.courseCode.trim(),
    courseTitle: input.courseTitle.trim(),
    topics,
    assessments,
  };
}
