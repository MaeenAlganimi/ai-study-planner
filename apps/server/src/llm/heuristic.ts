import { slugId, type Assessment, type AssessmentType, type Syllabus, type Topic } from "@atrium/shared";
import { SyllabusReadError } from "../errors";

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/**
 * Deterministic fallback used by demo mode when the upload is not the bundled
 * sample. It only keeps lines that already contain a date and a weight, so it
 * does not invent a course that is not on the page.
 */
export function extractSyllabusHeuristic(text: string): Syllabus {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new SyllabusReadError("That PDF has no readable text.");
  }

  const topics: Topic[] = [];
  const assessments: Assessment[] = [];

  for (const line of lines) {
    const week = /^week\s+(\d+)\s*[:\-–]\s*(.+)$/i.exec(line);
    if (week?.[1] && week[2]) {
      const [title, ...rest] = week[2].split(/\.\s+/);
      const trimmedTitle = title?.trim().replace(/\.$/, "");
      if (trimmedTitle) {
        topics.push({
          id: `week-${week[1]}`,
          title: trimmedTitle,
          description: rest.join(". ").trim() || undefined,
          weekLabel: `Week ${week[1]}`,
        });
      }
      continue;
    }

    const assessment = parseAssessmentLine(line);
    if (assessment) assessments.push(assessment);
  }

  if (assessments.length === 0) {
    throw new SyllabusReadError(
      "Demo mode couldn't find dates and grade weights in that PDF. Add a Gemini API key for a fuller read, or try the sample syllabus.",
    );
  }

  const courseCode = findCourseCode(lines) ?? "COURSE";
  const courseTitle = findCourseTitle(lines, courseCode);
  const instructor = findLabeled(lines, "instructor");
  const term = lines.find((line) => /\b(spring|summer|fall|winter)\s+20\d{2}\b/i.test(line));
  const description = paragraphAfter(text, "course description");
  const office = lines.find((line) => /office hours/i.test(line));
  const summary = [description, office].filter(Boolean).join(" ");

  const topicIds = new Set(topics.map((topic) => topic.id));
  return {
    courseCode,
    courseTitle,
    instructor,
    term: term?.match(/\b(?:spring|summer|fall|winter)\s+20\d{2}\b/i)?.[0],
    summary: summary || undefined,
    topics,
    assessments: assessments.map((assessment) => ({
      ...assessment,
      topicIds: assessment.topicIds.filter((id) => topicIds.has(id)),
    })),
  };
}

function parseAssessmentLine(line: string): Assessment | null {
  const dueDate = firstDate(line);
  const weight = firstWeight(line);
  if (!dueDate || weight === null) return null;
  let title = line;
  const dueAt = title.search(/\bdue\b/i);
  if (dueAt > 0) title = title.slice(0, dueAt);
  title = title.replace(
    /^(assignment|homework|problem set|quiz|midterm exam|midterm|final exam|final|project|exam)\s*\d*\s*[:\-–]\s*/i,
    "",
  );
  title = title.replace(/[.\s]+$/, "").trim();
  if (!title) return null;
  const id = slugId(title, "assessment");
  return {
    id,
    title,
    type: inferType(line),
    dueDate,
    weight,
    topicIds: [],
  };
}

function inferType(line: string): AssessmentType {
  const lower = line.toLowerCase();
  if (/\b(midterm|final|exam)\b/.test(lower)) return "exam";
  if (/\bquiz\b/.test(lower)) return "quiz";
  if (/\bproject\b/.test(lower)) return "project";
  if (/\b(reading|chapter)\b/.test(lower)) return "reading";
  if (/\b(assignment|homework|problem set|pset)\b/.test(lower)) return "assignment";
  return "other";
}

function firstWeight(line: string): number | null {
  const match = /\b(\d{1,3}(?:\.\d+)?)\s*%/.exec(line);
  if (!match?.[1]) return null;
  const weight = Number(match[1]);
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) return null;
  return weight;
}

function firstDate(line: string): string | null {
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(line);
  if (iso?.[1] && iso[2] && iso[3]) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/.exec(line);
  if (slash?.[1] && slash[2] && slash[3]) {
    return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }

  const month =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/i.exec(
      line,
    );
  if (month?.[1] && month[2] && month[3]) {
    const monthNumber = MONTHS[month[1].toLowerCase()];
    if (!monthNumber) return null;
    const day = Number(month[2]);
    if (day < 1 || day > 31) return null;
    return `${month[3]}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

function findCourseCode(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 8)) {
    const match = /\b([A-Z]{2,4})\s*(\d{3}[A-Z]?)\b/.exec(line);
    if (match?.[1] && match[2]) return `${match[1]} ${match[2]}`;
  }
  return undefined;
}

function findCourseTitle(lines: string[], courseCode: string): string {
  const first = lines[0] ?? courseCode;
  const pattern = new RegExp(courseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"), "i");
  const withoutCode = first.replace(pattern, "").replace(/^[\s—\-–:]+/, "").trim();
  return withoutCode || first;
}

function findLabeled(lines: string[], label: string): string | undefined {
  const line = lines.find((item) => new RegExp(`^${label}\\s*:`, "i").test(item));
  return line?.split(":").slice(1).join(":").trim() || undefined;
}

function paragraphAfter(text: string, heading: string): string | undefined {
  const pattern = new RegExp(`${heading}\\s*\\n+([\\s\\S]*?)(?:\\n\\s*\\n|$)`, "i");
  const match = pattern.exec(text);
  const paragraph = match?.[1]?.replace(/\s+/g, " ").trim();
  return paragraph || undefined;
}
