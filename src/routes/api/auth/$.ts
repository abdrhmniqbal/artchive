import { createFileRoute } from "@tanstack/react-router";
import { createAuth } from "@/lib/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { getEnvAsync } = await import("@/lib/env");
        const auth = createAuth(await getEnvAsync());
        return auth.handler(request);
      },
    },
  },
});
