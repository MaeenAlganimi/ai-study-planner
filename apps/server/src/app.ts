import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PlanRequestSchema,
  StudySessionSchema,
  SyllabusSchema,
  TutorRequestSchema,
  buildStudyPlan,
  normalizeSyllabus,
  sessionsToIcs,
} from "@atrium/shared";
import compression from "compression";
import cors from "cors";
import express, { type ErrorRequestHandler, type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer, { MulterError } from "multer";
import { ZodError, z } from "zod";
import type { AppConfig } from "./config";
import { HttpError, ModelError, SyllabusReadError } from "./errors";
import type { LlmProvider } from "./llm/types";
import { extractPdfText } from "./pdf/extractText";

const IcsRequestSchema = z.object({
  courseCode: z.string().trim().min(1).max(40),
  courseTitle: z.string().trim().min(1).max(160),
  sessions: z.array(StudySessionSchema).max(500),
});

export function createApp(options: { config: AppConfig; llm: LlmProvider }): Express {
  const { config, llm } = options;
  const app = express();
  if (config.trustProxy) app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: config.serveStatic
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
              imgSrc: ["'self'", "data:"],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(
    cors({
      origin: config.clientOrigins.length > 0 ? config.clientOrigins : true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  const generalLimit = makeLimiter(config.rateLimitPerMinute);
  const extractLimit = makeLimiter(config.extractLimitPerMinute);
  const tutorLimit = makeLimiter(config.tutorLimitPerMinute);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes, files: 1 },
  });

  app.get("/api/health", generalLimit, (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/config", generalLimit, (_req, res) => {
    res.json({
      demoMode: llm.name === "mock",
      provider: llm.name,
      maxUploadBytes: config.maxUploadBytes,
    });
  });

  app.get("/api/demo/syllabus.pdf", generalLimit, async (_req, res, next) => {
    try {
      const filePath = path.join(config.fixturesDir, "sample-syllabus.pdf");
      const bytes = await readFile(filePath);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=\"cs-301-syllabus.pdf\"");
      res.send(bytes);
    } catch {
      next(new HttpError(404, "The sample syllabus is missing."));
    }
  });

  app.post("/api/syllabus", extractLimit, (req, res, next) => {
    upload.single("file")(req, res, (error: unknown) => {
      if (error instanceof MulterError && error.code === "LIMIT_FILE_SIZE") {
        next(
          new HttpError(
            413,
            `That PDF is too large. The limit is ${formatMegabytes(config.maxUploadBytes)}.`,
          ),
        );
        return;
      }
      if (error) {
        next(new HttpError(400, "Upload a single PDF syllabus."));
        return;
      }
      next();
    });
  }, async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) throw new HttpError(400, "Choose a PDF syllabus to upload.");
      if (!looksLikePdf(file.buffer, file.mimetype)) {
        throw new HttpError(415, "Upload a PDF file.");
      }
      const extracted = await extractPdfText(new Uint8Array(file.buffer));
      const syllabus = normalizeSyllabus(SyllabusSchema.parse(await llm.extractSyllabus({ text: extracted.text })));
      res.json({
        syllabus,
        provider: llm.name,
        truncated: extracted.truncated,
        pages: extracted.pages,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/plan", generalLimit, (req, res, next) => {
    try {
      const body = PlanRequestSchema.parse(req.body);
      const plan = buildStudyPlan({
        assessments: body.syllabus.assessments,
        availability: body.availability,
        startDate: body.startDate,
        sessionMinutes: body.sessionMinutes,
        dayStartHour: body.dayStartHour,
        minutesPerWeightPoint: body.minutesPerWeightPoint,
      });
      res.json({ plan });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tutor", tutorLimit, async (req, res, next) => {
    try {
      const body = TutorRequestSchema.parse(req.body);
      const reply = await llm.answerTutor(body);
      res.json(reply);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/plan/export.ics", generalLimit, (req, res, next) => {
    try {
      const body = IcsRequestSchema.parse(req.body);
      const ics = sessionsToIcs({
        calendarName: `Atrium · ${body.courseCode} ${body.courseTitle}`,
        courseCode: body.courseCode,
        sessions: body.sessions,
      });
      const filename = `${body.courseCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-study-plan.ics`;
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(ics);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  if (config.serveStatic) {
    app.use(express.static(config.webDistDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(config.webDistDir, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}

function looksLikePdf(buffer: Buffer, mime: string): boolean {
  const mimeOk = !mime || mime === "application/pdf" || mime === "application/octet-stream";
  const header = buffer.subarray(0, 5).toString("utf8");
  return mimeOk && header.startsWith("%PDF");
}

function makeLimiter(limit: number) {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: { trustProxy: false },
    handler: (_req, res) => {
      res.status(429).json({ error: "Too many requests. Try again in a minute." });
    },
  });
}

function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues[0]?.message ?? "Check the request and try again." });
    return;
  }
  if (error instanceof SyllabusReadError) {
    res.status(422).json({ error: error.message });
    return;
  }
  if (error instanceof ModelError) {
    res.status(502).json({ error: "The model is unavailable right now. Try again in a moment." });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
};
