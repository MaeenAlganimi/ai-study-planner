import type { Syllabus, TutorReply, TutorRequest } from "@atrium/shared";

/**
 * Swap the model by implementing this interface and returning it from
 * `createLlmProvider`. The scheduler does not call an LLM; only extraction
 * and the tutor do. Both methods must return zod-validated objects.
 */
export interface LlmProvider {
  readonly name: "mock" | "gemini";
  extractSyllabus(input: { text: string }): Promise<Syllabus>;
  answerTutor(input: TutorRequest): Promise<TutorReply>;
}
