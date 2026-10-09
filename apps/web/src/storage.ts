import {
  AvailabilitySchema,
  StudyPlanSchema,
  SyllabusSchema,
  type Availability,
  type StudyPlan,
  type Syllabus,
} from "@atrium/shared";

const KEY = "atrium.workspace.v1";

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

export interface StoredWorkspace {
  syllabus: Syllabus;
  plan: StudyPlan | null;
  availability: Availability;
  startDate: string;
  sessionMinutes: number;
  messages: StoredMessage[];
}

export function loadWorkspace(): StoredWorkspace | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredWorkspace>;
    return {
      syllabus: SyllabusSchema.parse(parsed.syllabus),
      plan: parsed.plan ? StudyPlanSchema.parse(parsed.plan) : null,
      availability: AvailabilitySchema.parse(parsed.availability),
      startDate: typeof parsed.startDate === "string" ? parsed.startDate : "",
      sessionMinutes: typeof parsed.sessionMinutes === "number" ? parsed.sessionMinutes : 60,
      messages: Array.isArray(parsed.messages) ? parsed.messages.filter(isMessage) : [],
    };
  } catch {
    return null;
  }
}

export function saveWorkspace(workspace: StoredWorkspace): void {
  localStorage.setItem(KEY, JSON.stringify(workspace));
}

export function clearWorkspace(): void {
  localStorage.removeItem(KEY);
}

function isMessage(value: unknown): value is StoredMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as StoredMessage;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.length > 0
  );
}
