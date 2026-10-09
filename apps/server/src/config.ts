export interface AppConfig {
  port: number;
  clientOrigins: string[];
  maxUploadBytes: number;
  rateLimitPerMinute: number;
  extractLimitPerMinute: number;
  tutorLimitPerMinute: number;
  serveStatic: boolean;
  trustProxy: boolean;
  webDistDir: string;
  fixturesDir: string;
}

export function readConfig(
  env: NodeJS.ProcessEnv,
  paths: { webDistDir: string; fixturesDir: string },
): AppConfig {
  const upload = Number(env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024);
  return {
    port: Number(env.PORT ?? 8787),
    clientOrigins: (env.CLIENT_ORIGIN ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxUploadBytes: Number.isFinite(upload) && upload > 0 ? upload : 5 * 1024 * 1024,
    rateLimitPerMinute: numberFromEnv(env.RATE_LIMIT_PER_MINUTE, env.VITEST ? 10_000 : 60),
    extractLimitPerMinute: numberFromEnv(env.EXTRACT_LIMIT_PER_MINUTE, env.VITEST ? 10_000 : 8),
    tutorLimitPerMinute: numberFromEnv(env.TUTOR_LIMIT_PER_MINUTE, env.VITEST ? 10_000 : 20),
    serveStatic: env.NODE_ENV === "production",
    trustProxy: env.TRUST_PROXY !== "0",
    webDistDir: paths.webDistDir,
    fixturesDir: paths.fixturesDir,
  };
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
