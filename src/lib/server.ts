import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { Env } from "@/lib/env";
import { createAuth } from "@/lib/auth";
import * as schema from "@/lib/db/schema";

export async function getServerContext() {
  const { getEnvAsync } = await import("@/lib/env");
  const env: Env = await getEnvAsync();
  const db = getDb(env.DB);
  const auth = createAuth(env);
  return { db, auth, env, schema };
}

export async function getHeaders(): Promise<Headers> {
  const { getRequest } = await import("@tanstack/react-start/server");
  return getRequest().headers;
}

export async function getSessionUser() {
  const { db, auth } = await getServerContext();
  const session = await auth.api.getSession({ headers: await getHeaders() });
  if (!session) return null;
  const [user] = await db.select().from(schema.user).where(eq(schema.user.id, session.user.id)).limit(1);
  if (!user || user.banned) return null; // banned users are effectively signed out
  return user;
}

/**
 * Rate limiting via the Cloudflare Workers Rate Limiting binding (edge-native, no DB).
 * `tight` uses the stricter namespace (signups, collect). Returns true when allowed.
 */
export async function rateLimit(key: string, opts?: { tight?: boolean }): Promise<boolean> {
  const { env } = await getServerContext();
  const limiter = opts?.tight ? env.RATE_LIMITER_TIGHT : env.RATE_LIMITER;
  const { success } = await limiter.limit({ key });
  return success;
}

export function clientIpHash(headers: Headers): string {
  const ip = headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // hash so raw visitor IPs are never stored
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function toPublicUser(u: { id: string; name: string; username: string | null; image: string | null; bio?: string | null }) {
  // username is null only for OAuth users who have not finished /welcome yet;
  // the _app gate redirects them before any username-dependent page renders.
  return { id: u.id, name: u.name, username: u.username ?? "", image: u.image, bio: u.bio ?? null };
}
