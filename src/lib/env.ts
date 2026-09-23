import { z } from "zod";

const binding = <T>(name: string) =>
  z.custom<T>((v) => v !== undefined && v !== null, { error: `Missing ${name} binding` });

const envSchema = z.object({
  DB: binding<D1Database>("DB"),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 chars"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  ANONDROP_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  RATE_LIMITER: binding<{ limit: (opts: { key: string }) => Promise<{ success: boolean }> }>("RATE_LIMITER"),
  RATE_LIMITER_TIGHT: binding<{ limit: (opts: { key: string }) => Promise<{ success: boolean }> }>(
    "RATE_LIMITER_TIGHT",
  ),
});

export type Env = z.infer<typeof envSchema>;

async function readSources(): Promise<Record<string, unknown>[]> {
  const sources: Record<string, unknown>[] = [];
  const fromGlobal = (globalThis as unknown as { __env__?: Record<string, unknown> }).__env__;
  if (fromGlobal) sources.push(fromGlobal);
  try {
    const workers = await import("cloudflare:workers");
    const workerEnv = (workers as unknown as { env?: Record<string, unknown> }).env;
    if (workerEnv) sources.push(workerEnv);
  } catch {
    // not running inside a worker (local vite / node)
  }
  if (typeof process !== "undefined" && process.env) sources.push(process.env as Record<string, unknown>);
  return sources;
}

/** Merge all env sources. Later sources fill gaps; worker bindings always win. */
export async function readMergedEnv(): Promise<Record<string, unknown>> {
  const merged: Record<string, unknown> = {};
  for (const src of await readSources()) {
    for (const [k, v] of Object.entries(src)) {
      if (merged[k] === undefined || merged[k] === null || merged[k] === "") merged[k] = v;
    }
  }
  return merged;
}

/** Validated env from all available sources. */
export async function getEnvAsync(raw?: Record<string, unknown>): Promise<Env> {
  if (raw) return envSchema.parse(raw);
  return envSchema.parse(await readMergedEnv());
}

/** Sync validated env (local dev only: globalThis.__env__ / process.env). */
export function getEnv(raw?: Record<string, unknown>): Env {
  const fromGlobal = (globalThis as unknown as { __env__?: Record<string, unknown> }).__env__;
  const base = raw ?? fromGlobal ?? ((typeof process !== "undefined" ? process.env : {}) as Record<string, unknown>);
  return envSchema.parse(base);
}

/** TEMPORARY debug helper: reports which keys exist in each source (never values). */
export async function debugEnvSources() {
  const report: Record<string, { keys: string[]; types: Record<string, string> }> = {};
  const fromGlobal = (globalThis as unknown as { __env__?: Record<string, unknown> }).__env__;
  if (fromGlobal) {
    report.globalThis = {
      keys: Object.keys(fromGlobal),
      types: Object.fromEntries(Object.entries(fromGlobal).map(([k, v]) => [k, typeof v])),
    };
  }
  try {
    const workers = await import("cloudflare:workers");
    const workerEnv = (workers as unknown as { env?: Record<string, unknown> }).env;
    if (workerEnv) {
      report.workers = {
        keys: Object.keys(workerEnv),
        types: Object.fromEntries(
          Object.entries(workerEnv).map(([k, v]) => [k, v === null ? "null" : typeof v]),
        ),
      };
    } else {
      report.workers = { keys: [], types: { note: "import ok but env empty" } };
    }
  } catch (e) {
    report.workers = { keys: [], types: { note: `import failed: ${e instanceof Error ? e.message : String(e)}` } };
  }
  if (typeof process !== "undefined" && process.env) {
    const keys = Object.keys(process.env).filter((k) =>
      ["DB", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "ANONDROP_KEY", "RESEND_API_KEY", "EMAIL_FROM", "RATE_LIMITER", "RATE_LIMITER_TIGHT"].includes(k),
    );
    report.process = { keys, types: Object.fromEntries(keys.map((k) => [k, typeof process.env[k]])) };
  }
  return report;
}
