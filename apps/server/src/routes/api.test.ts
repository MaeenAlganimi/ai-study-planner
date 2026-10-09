import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_AVAILABILITY, SAMPLE_SYLLABUS } from "@atrium/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import type { AppConfig } from "../config";
import { MockLlmProvider } from "../llm/mockProvider";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fixtures");
const samplePdf = readFileSync(path.join(fixturesDir, "sample-syllabus.pdf"));

function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    clientOrigins: [],
    maxUploadBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 10_000,
    extractLimitPerMinute: 10_000,
    tutorLimitPerMinute: 10_000,
    serveStatic: false,
    trustProxy: false,
    webDistDir: path.resolve(fixturesDir, "../../web/dist"),
    fixturesDir,
    ...overrides,
  };
}

function app(overrides: Partial<AppConfig> = {}) {
  return createApp({ config: testConfig(overrides), llm: new MockLlmProvider() });
}

describe("API", () => {
  it("reports health and demo mode without exposing a key", async () => {
    const server = app();
    const health = await request(server).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ ok: true });

    const config = await request(server).get("/api/config");
    expect(config.body.demoMode).toBe(true);
    expect(config.body.provider).toBe("mock");
    expect(JSON.stringify(config.body)).not.toMatch(/api[_-]?key/i);
  });

  it("serves the sample syllabus PDF", async () => {
    const response = await request(app()).get("/api/demo/syllabus.pdf");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/pdf/);
    expect(response.body.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("rejects uploads that are not PDFs", async () => {
    const missing = await request(app()).post("/api/syllabus");
    expect(missing.status).toBe(400);

    const text = await request(app())
      .post("/api/syllabus")
      .attach("file", Buffer.from("not a pdf"), { filename: "notes.pdf", contentType: "application/pdf" });
    expect(text.status).toBe(415);
  });

  it("rejects a PDF over the size limit", async () => {
    const tooBig = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2_000, 1)]);
    const response = await request(app({ maxUploadBytes: 500 }))
      .post("/api/syllabus")
      .attach("file", tooBig, { filename: "big.pdf", contentType: "application/pdf" });
    expect(response.status).toBe(413);
  });

  it("extracts the sample syllabus through the mock provider", async () => {
    const response = await request(app())
      .post("/api/syllabus")
      .attach("file", samplePdf, { filename: "cs-301.pdf", contentType: "application/pdf" });
    expect(response.status).toBe(200);
    expect(response.body.provider).toBe("mock");
    expect(response.body.syllabus.courseCode).toBe("CS 301");
    expect(response.body.syllabus.assessments).toHaveLength(SAMPLE_SYLLABUS.assessments.length);
    expect(response.body.syllabus.assessments.map((item: { title: string }) => item.title)).toContain("Midterm exam");
  });

  it("builds a plan that keeps the midterm before exam day", async () => {
    const response = await request(app())
      .post("/api/plan")
      .send({
        syllabus: SAMPLE_SYLLABUS,
        availability: DEFAULT_AVAILABILITY,
        startDate: "2026-10-09",
        sessionMinutes: 60,
      });
    expect(response.status).toBe(200);
    const sessions = response.body.plan.sessions as Array<{ date: string; assessmentId: string }>;
    expect(sessions.length).toBeGreaterThan(0);
    const midterm = sessions.filter((session) => session.assessmentId === "midterm");
    expect(midterm.length).toBeGreaterThan(0);
    expect(midterm.every((session) => session.date < "2026-10-22")).toBe(true);
  });

  it("answers a tutor question from the syllabus", async () => {
    const response = await request(app()).post("/api/tutor").send({
      message: "When is the midterm and what does it cover?",
      syllabus: SAMPLE_SYLLABUS,
      plan: null,
      history: [],
    });
    expect(response.status).toBe(200);
    expect(response.body.answer).toMatch(/October 22/);
    expect(response.body.answer).toMatch(/25%/);
    expect(response.body.answer).toMatch(/Hash tables/);
    expect(response.body.citations).toContain("Midterm exam");
  });

  it("refuses a plan with an impossible date", async () => {
    const response = await request(app())
      .post("/api/plan")
      .send({
        syllabus: SAMPLE_SYLLABUS,
        availability: DEFAULT_AVAILABILITY,
        startDate: "2026-02-31",
      });
    expect(response.status).toBe(400);
  });

  it("exports an ics calendar", async () => {
    const response = await request(app())
      .post("/api/plan/export.ics")
      .send({
        courseCode: "CS 301",
        courseTitle: "Data Structures and Algorithms",
        sessions: [
          {
            id: "midterm-1",
            date: "2026-10-12",
            startMinutes: 9 * 60,
            durationMinutes: 60,
            assessmentId: "midterm",
            title: "Learn · Midterm exam",
            kind: "learn",
            topicIds: ["trees"],
          },
        ],
      });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/calendar/);
    expect(response.text).toContain("DTSTART:20261012T090000");
    expect(response.headers["content-disposition"]).toContain("cs-301-study-plan.ics");
  });

  it("rate limits repeated syllabus uploads", async () => {
    const server = app({ extractLimitPerMinute: 2 });
    const send = () =>
      request(server)
        .post("/api/syllabus")
        .attach("file", Buffer.from("hello"), { filename: "notes.txt", contentType: "text/plain" });
    expect((await send()).status).toBe(415);
    expect((await send()).status).toBe(415);
    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many requests/i);
  });
});
