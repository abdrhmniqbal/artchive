import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

// Env lives in @/lib/env (zod-validated). Re-exported here so existing
// `import type { Env } from "@/lib/db"` call sites keep working.
export type { Env } from "@/lib/env";
