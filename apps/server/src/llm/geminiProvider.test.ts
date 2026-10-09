import { describe, expect, it, vi } from "vitest";
import { SAMPLE_SYLLABUS } from "@atrium/shared";
import { ModelError } from "../errors";
import { GeminiProvider } from "./geminiProvider";
import { EXTRACTION_INSTRUCTIONS, TUTOR_INSTRUCTIONS } from "./prompts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }],
  }), { status, headers: { "content-type": "application/json" } });
}

describe("GeminiProvider", () => {
  it("validates a structured syllabus and does not send the API key in the URL", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).not.toContain("secret-key");
      expect(init?.headers).toMatchObject({ "x-goog-api-key": "secret-key" });
      const payload = JSON.parse(String(init?.body));
      expect(payload.contents[0].parts[0].text).toContain(EXTRACTION_INSTRUCTIONS);
      expect(payload.generationConfig.responseMimeType).toBe("application/json");
      return jsonResponse({
        ...SAMPLE_SYLLABUS,
        instructor: "",
      });
    });

    const provider = new GeminiProvider({
      apiKey: "secret-key",
      model: "gemini-2.5-flash",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const syllabus = await provider.extractSyllabus({ text: "CS 301 syllabus" });
    expect(syllabus.courseCode).toBe("CS 301");
    expect(syllabus.instructor).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries once when the first payload fails schema validation", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ courseTitle: "Missing the rest" }))
      .mockResolvedValueOnce(jsonResponse(SAMPLE_SYLLABUS));

    const provider = new GeminiProvider({
      apiKey: "secret-key",
      model: "gemini-2.5-flash",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const syllabus = await provider.extractSyllabus({ text: "syllabus" });
    expect(syllabus.assessments).toHaveLength(7);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops after a second invalid tutor payload", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ answer: "" }));
    const provider = new GeminiProvider({
      apiKey: "secret-key",
      model: "gemini-2.5-flash",
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(
      provider.answerTutor({
        message: "When is the midterm?",
        syllabus: SAMPLE_SYLLABUS,
        plan: null,
        history: [],
      }),
    ).rejects.toBeInstanceOf(ModelError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const secondCall = fetchImpl.mock.calls[1];
    const secondBody = JSON.parse(String(secondCall?.[1]?.body));
    expect(secondBody.contents[0].parts[0].text).toContain(TUTOR_INSTRUCTIONS);
  });
});
