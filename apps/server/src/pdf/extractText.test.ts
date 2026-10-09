import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { SAMPLE_SYLLABUS } from "@atrium/shared";
import { extractPdfText } from "./extractText";

const samplePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/sample-syllabus.pdf",
);

describe("extractPdfText", () => {
  it("reads the bundled syllabus, including deadlines and weights", async () => {
    const bytes = new Uint8Array(readFileSync(samplePath));
    const extracted = await extractPdfText(bytes);
    expect(extracted.pages).toBeGreaterThan(0);
    expect(extracted.text).toMatch(/CS 301/);
    expect(extracted.text).toMatch(/Lena Okonkwo/);
    expect(extracted.text).toMatch(/October 22, 2026/);
    expect(extracted.text).toMatch(/Weight 25%/);
    for (const assessment of SAMPLE_SYLLABUS.assessments) {
      expect(extracted.text.toLowerCase()).toContain(assessment.title.toLowerCase());
    }
  });

  it("rejects a PDF page with no text", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    await expect(extractPdfText(bytes)).rejects.toThrow(/no readable text/i);
  });
});
