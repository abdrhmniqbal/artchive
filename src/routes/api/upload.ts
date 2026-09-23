import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { rateLimit, clientIpHash, getServerContext } = await import("@/lib/server");
          if (!(await rateLimit(`upload:${clientIpHash(request.headers)}`, { tight: true }))) {
            return Response.json({ error: "Rate limited" }, { status: 429 });
          }
          const { env } = await getServerContext();
          const key = env.ANONDROP_KEY;
          if (!key) return Response.json({ error: "Upload not configured" }, { status: 500 });

          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
          if (file.size > 10 * 1024 * 1024) return Response.json({ error: "File too large (max 10MB)" }, { status: 400 });
          if (!file.type.startsWith("image/")) return Response.json({ error: "Images only" }, { status: 400 });

          const fd = new FormData();
          fd.append("file", file);
          const upstream = await fetch(`https://anondrop.io/upload?key=${encodeURIComponent(key)}`, {
            method: "POST",
            body: fd,
          });
          if (!upstream.ok) return Response.json({ error: "Upload failed" }, { status: 502 });
          const text = await upstream.text();
          const linkMatch = text.match(/href=['"]([^'"]+)['"]/) ?? text.match(/https?:\/\/[^\s<>'"]+/g);
          const link = linkMatch?.[1] ?? linkMatch?.[0];
          if (!link) return Response.json({ error: "Unexpected upload response" }, { status: 502 });
          return Response.json({ link, filename: file.name });
        } catch {
          return Response.json({ error: "Upload failed" }, { status: 500 });
        }
      },
    },
  },
});
