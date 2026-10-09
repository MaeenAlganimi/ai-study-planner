import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, "../fixtures");
const source = path.join(fixtures, "sample-syllabus.txt");
const target = path.join(fixtures, "sample-syllabus.pdf");

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 56;
const BODY_SIZE = 11;
const LEADING = 15;

async function main(): Promise<void> {
  const text = await readFile(source, "utf8");
  const doc = await PDFDocument.create();
  doc.setTitle("CS 301 Data Structures and Algorithms — Syllabus");
  doc.setAuthor("Dr. Lena Okonkwo");
  doc.setSubject("Sample syllabus for the Atrium study planner");
  doc.setCreator("Atrium");

  const body = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensure = (size: number) => {
    if (y - size < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawWrapped = (line: string, font: typeof body, size: number, color = rgb(0.11, 0.1, 0.08)) => {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      y -= LEADING * 0.6;
      return;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
        ensure(size);
        page.drawText(current, { x: MARGIN, y, size, font, color });
        y -= LEADING;
        current = word;
      } else {
        current = next;
      }
    }
    if (current) {
      ensure(size);
      page.drawText(current, { x: MARGIN, y, size, font, color });
      y -= LEADING;
    }
  };

  const blocks = text.trim().split(/\n\n+/);
  blocks.forEach((block, index) => {
    const lines = block.split("\n");
    lines.forEach((line, lineIndex) => {
      const isTitle = index === 0 && lineIndex === 0;
      const isHeading =
        line === "Course description" ||
        line === "Weekly topics" ||
        line === "Assessments" ||
        line === "Policies" ||
        line === "Grading";
      if (isTitle) {
        drawWrapped(line, bold, 18);
        y -= 4;
        return;
      }
      if (isHeading) {
        y -= 6;
        drawWrapped(line, bold, 13);
        return;
      }
      drawWrapped(line, body, BODY_SIZE);
    });
    y -= 6;
  });

  const bytes = await doc.save();
  await writeFile(target, bytes);
  console.log(`Wrote ${target} (${bytes.length} bytes, ${doc.getPageCount()} pages)`);
}

await main();
