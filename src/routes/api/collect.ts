import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/collect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { rateLimit, clientIpHash, getServerContext } = await import("@/lib/server");
          if (!(await rateLimit(`collect:${clientIpHash(request.headers)}`, { tight: true }))) {
            return new Response(null, { status: 429 });
          }
          const payload = (await request.json()) as
            | { events?: unknown[] }
            | Record<string, unknown>;
          const events = Array.isArray((payload as { events?: unknown[] }).events)
            ? (payload as { events: unknown[] }).events
            : [payload];
          const rows = events.slice(0, 25).map((e) => normalizeEvent(e as Record<string, unknown>));
          if (rows.length) {
            const { db } = await getServerContext();
            const { analyticsEvent } = await import("@/lib/db/schema");
            await db.insert(analyticsEvent).values(rows);
          }
          return new Response(null, {
            status: 204,
            headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
          });
        } catch {
          return new Response(null, { status: 204 });
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        }),
    },
  },
});

function normalizeEvent(e: Record<string, unknown>) {
  // better-analytics SDK payload: { event, url, referrer, site, sessionId, deviceId, device, properties? }
  const eventName = (e.event as string) ?? (e.name as string) ?? "";
  const type = eventName === "pageview" || eventName === "$pageview" || e.type === "pageview" ? "pageview" : "event";
  const props = (e.properties ?? e.props ?? null) as Record<string, unknown> | null;
  const rawUrl = (e.url as string) ?? (props?.path as string) ?? null;
  let path: string | null = null;
  if (rawUrl) {
    try {
      path = new URL(rawUrl).pathname;
    } catch {
      path = rawUrl;
    }
  }
  const userId = (props?.userId as string) ?? (e.userId as string) ?? null;
  return {
    id: crypto.randomUUID(),
    type,
    name: type === "pageview" ? null : eventName || "unknown",
    path,
    referrer: ((e.referrer as string) || null) || null,
    sessionId: ((e.sessionId as string) ?? (e.deviceId as string) ?? null) || null,
    userId,
    props: { ...props, device: e.device ?? null, site: e.site ?? null },
  };
}
