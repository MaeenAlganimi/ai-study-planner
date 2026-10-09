import type { StudyPlan, Syllabus, TutorReply, TutorRequest, PlanRequest } from "@atrium/shared";

export interface PublicConfig {
  demoMode: boolean;
  provider: "mock" | "gemini";
  maxUploadBytes: number;
}

export interface ExtractedSyllabus {
  syllabus: Syllabus;
  provider: "mock" | "gemini";
  truncated: boolean;
  pages: number;
}

function apiBase(): string {
  return (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    /* The body was not JSON. */
  }
  return `Request failed (${response.status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, init);
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

export function fetchConfig(): Promise<PublicConfig> {
  return request<PublicConfig>("/api/config");
}

export async function fetchSamplePdf(): Promise<File> {
  const response = await fetch(`${apiBase()}/api/demo/syllabus.pdf`);
  if (!response.ok) throw new Error("The sample syllabus is unavailable.");
  const blob = await response.blob();
  return new File([blob], "cs-301-syllabus.pdf", { type: "application/pdf" });
}

export function extractSyllabus(file: File): Promise<ExtractedSyllabus> {
  const body = new FormData();
  body.append("file", file);
  return request<ExtractedSyllabus>("/api/syllabus", { method: "POST", body });
}

export async function createPlan(input: {
  syllabus: Syllabus;
  availability: PlanRequest["availability"];
  startDate: string;
  sessionMinutes: number;
}): Promise<StudyPlan> {
  const response = await request<{ plan: StudyPlan }>("/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.plan;
}

export function askTutor(input: TutorRequest): Promise<TutorReply> {
  return request<TutorReply>("/api/tutor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
