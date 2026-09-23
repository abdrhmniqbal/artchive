import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  result.response.headers.set("X-Content-Type-Options", "nosniff");
  result.response.headers.set("X-Frame-Options", "DENY");
  result.response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  result.response.headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  result.response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  setResponseHeaders(result.response.headers);
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, securityHeadersMiddleware],
}));
