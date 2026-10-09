import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractSyllabusHeuristic } from "./heuristic";

const fixture = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fixtures/sample-syllabus.txt"),
  "utf8",
);

describe("extractSyllabusHeuristic", () => {
  const syllabus = extractSyllabusHeuristic(fixture);

  it("reads the course, the midterm, and every weighted deadline", () => {
    expect(syllabus.courseCode).toBe("CS 301");
    expect(syllabus.courseTitle).toBe("Data Structures and Algorithms");
    expect(syllabus.instructor).toBe("Dr. Lena Okonkwo");
    expect(syllabus.assessments).toHaveLength(7);
    const midterm = syllabus.assessments.find((assessment) => assessment.dueDate === "2026-10-22");
    expect(midterm).toMatchObject({ title: "Midterm exam", type: "exam", weight: 25 });
  });

  it("keeps weekly topics in order", () => {
    expect(syllabus.topics[0]).toMatchObject({ title: "Asymptotic analysis", weekLabel: "Week 1" });
    expect(syllabus.topics).toHaveLength(12);
    expect(syllabus.summary).toMatch(/implement the structures/i);
  });

  it("refuses a document with no dates or weights", () => {
    expect(() => extractSyllabusHeuristic("Office hours are on Tuesday.\nBring a pencil.")).toThrow(
      /dates and grade weights/i,
    );
  });
});
