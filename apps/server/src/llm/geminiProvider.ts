import {
  SyllabusSchema,
  TutorReplySchema,
  normalizeSyllabus,
  type Syllabus,
  type TutorReply,
  type TutorRequest,
} from "@atrium/shared";
import { ModelError } from "../errors";
import { parseModelJson } from "./json";
import { buildExtractionPrompt, buildTutorContents, syllabusResponseSchema, tutorResponseSchema } from "./prompts";
import type { LlmProvider } from "./types";

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini" as const;

  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async extractSyllabus(input: { text: string }): Promise<Syllabus> {
    return this.generateValidated({
      prompt: buildExtractionPrompt(input.text),
      responseSchema: syllabusResponseSchema,
      temperature: 0.1,
      parse: (value) => normalizeSyllabus(SyllabusSchema.parse(cleanSyllabusPayload(value))),
    });
  }

  async answerTutor(input: TutorRequest): Promise<TutorReply> {
    return this.generateValidated({
      prompt: buildTutorContents(input),
      responseSchema: tutorResponseSchema,
      temperature: 0.3,
      parse: (value) => TutorReplySchema.parse(value),
    });
  }

  private async generateValidated<T>(options: {
    prompt: string;
    responseSchema: object;
    temperature: number;
    parse: (value: unknown) => T;
  }): Promise<T> {
    let prompt = options.prompt;
    let lastError = "The model returned data that did not match the schema.";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const text = await this.request(prompt, options.responseSchema, options.temperature);
      try {
        return options.parse(parseModelJson(text));
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
        prompt = `${options.prompt}\n\nYour previous JSON failed validation (${lastError}). Return only corrected JSON.`;
      }
    }
    throw new ModelError(lastError);
  }

  private async request(prompt: string, responseSchema: object, temperature: number): Promise<string> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.options.model)}:generateContent`;
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.options.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ModelError("The model request did not complete.");
    }

    if (!response.ok) {
      throw new ModelError(`The model returned status ${response.status}.`);
    }

    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) throw new ModelError("The model returned an empty response.");
    return text;
  }
}

function cleanSyllabusPayload(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = { ...(value as Record<string, unknown>) };
  for (const key of ["instructor", "term", "summary"]) {
    if (typeof record[key] === "string" && record[key].trim() === "") delete record[key];
  }
  if (Array.isArray(record.topics)) {
    record.topics = record.topics.map((topic) => {
      if (!topic || typeof topic !== "object") return topic;
      const copy = { ...(topic as Record<string, unknown>) };
      for (const key of ["description", "weekLabel"]) {
        if (typeof copy[key] === "string" && copy[key].trim() === "") delete copy[key];
      }
      return copy;
    });
  }
  return record;
}
