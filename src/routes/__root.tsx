import { createRootRouteWithContext, HeadContent, Scripts, Link, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import appCss from "../styles.css?url";
import { EmptyState } from "@/components/app-shell";
import { Toaster } from "@/components/ui/toaster";
import { analyticsPageview, initAnalytics } from "@/lib/analytics";
import { useEffect } from "react";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Artchive · share your muses" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: ErrorPage,
});

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <EmptyState
        title="Page not found"
        description="The page you're looking for doesn't exist or was removed."
        action={
          <Link to="/" className="text-sm text-[var(--v-text-2)] underline underline-offset-2 hover:underline">
            Back to home
          </Link>
        }
      />
    </div>
  );
}

function ErrorPage({ error }: ErrorComponentProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <EmptyState
        title="Something went wrong"
        description={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
        action={
          <Link to="/" className="text-sm text-[var(--v-text-2)] underline underline-offset-2 hover:underline">
            Back to home
          </Link>
        }
      />
    </div>
  );
}

function RouteAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    initAnalytics();
    analyticsPageview();
  }, [pathname]);
  return null;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var m=localStorage.getItem("theme");if(m!=="light"&&m!=="dark")m=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.mode=m;}catch(e){}})();`,
        }}
      />
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <RouteAnalytics />
        <Scripts />
      </body>
    </html>
  );
}
