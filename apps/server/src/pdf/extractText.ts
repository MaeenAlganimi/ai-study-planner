import { extractText, getDocumentProxy } from "unpdf";
import { SyllabusReadError } from "../errors";

const MAX_TEXT_CHARS = 50_000;

export async function extractPdfText(data: Uint8Array): Promise<{ text: string; truncated: boolean; pages: number }> {
  try {
    const pdf = await getDocumentProxy(data);
    const extracted = await extractText(pdf, { mergePages: true });
    const raw = extracted.text.replaceAll("\u0000", "");
    const cleaned = raw
      .split("\n")
      .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!cleaned) {
      throw new SyllabusReadError("That PDF has no readable text. Export it as a text PDF and try again.");
    }
    const truncated = cleaned.length > MAX_TEXT_CHARS;
    return {
      text: truncated ? cleaned.slice(0, MAX_TEXT_CHARS) : cleaned,
      truncated,
      pages: extracted.totalPages,
    };
  } catch (error) {
    if (error instanceof SyllabusReadError) throw error;
    throw new SyllabusReadError("I couldn't read that PDF. Try exporting the syllabus again.");
  }
}
