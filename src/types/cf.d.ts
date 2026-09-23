// Minimal Cloudflare D1 + env typings, scoped locally so the full
// @cloudflare/workers-types global set doesn't clash with DOM lib
// (which breaks cojeev's client-side motion libs).
declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
  withSession<T = unknown>(constraintOrBookmark?: string | D1SessionConstraint | null): D1DatabaseSession<T>;
  dump(): Promise<ArrayBuffer>;
}
declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<D1Result<T>>;
}
declare interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}
declare interface D1ExecResult {
  count: number;
  duration: number;
}
declare type D1SessionConstraint = "primary" | string;
declare interface D1DatabaseSession<T = unknown> {
  prepare(query: string): D1PreparedStatement;
  batch<T2 = T>(statements: D1PreparedStatement[]): Promise<D1Result<T2>[]>;
  getBookmark(): Promise<string | null>;
  getBookmarkIgnoreReloads(): Promise<string | null>;
  setCurrentBookmark(bookmark: string | null): void;
  setCurrentBookmarkIgnoreReloads(bookmark: string | null): void;
}
declare module "cloudflare:workers" {
  export const env: Env;
}
interface Env {
  DB: D1Database;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET?: string;
  RATE_LIMITER: RateLimitBinding;
  RATE_LIMITER_TIGHT: RateLimitBinding;
}
