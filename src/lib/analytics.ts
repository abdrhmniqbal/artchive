import { init, trackPageview, track as baTrack } from "better-analytics";

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  init({ site: "artchive", endpoint: "/api/collect" });
}

export function analyticsPageview() {
  if (typeof window === "undefined") return;
  initAnalytics();
  try { trackPageview(); } catch { /* noop */ }
}

export function track(name: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  initAnalytics();
  try { baTrack(name, properties ?? {}); } catch { /* noop */ }
}
