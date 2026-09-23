import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MotionSurface } from "@/components/ui/presence";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { feedback } from "@/components/ui/toaster";
import { humanizeAuthError } from "@/lib/feedback";
import { authProviders, startGoogleSignIn } from "@/lib/queries";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function GoogleButton() {
  const { data: providers } = useQuery({ queryKey: ["authProviders"], queryFn: authProviders, staleTime: 300_000 });
  const google = useMutation({
    mutationFn: () => startGoogleSignIn(),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  if (!providers?.google) return null;

  return (
    <>
      <div className="mt-5 flex items-center gap-3 text-xs text-[var(--v-text-2)]">
        <span className="h-px flex-1 bg-[var(--v-border)]" />
        or
        <span className="h-px flex-1 bg-[var(--v-border)]" />
      </div>
      <Button variant="outline" className="mt-3 w-full" loading={google.isPending} onClick={() => google.mutate()}>
        <GoogleMark /> Continue with Google
      </Button>
    </>
  );
}

export const Route = createFileRoute("/_auth")({
  component: AuthShell,
});


type Tile = { h: number; bg: string; muse?: string };

const COLS: Tile[][] = [
  [
    { h: 150, bg: "linear-gradient(135deg, var(--v-pink), var(--v-pink-deep))", muse: "mina" },
    { h: 110, bg: "linear-gradient(135deg, var(--v-beige-2), var(--v-beige))" },
    { h: 170, bg: "linear-gradient(135deg, var(--v-olive), var(--v-olive-deep))", muse: "yuna" },
    { h: 120, bg: "linear-gradient(135deg, var(--v-blue), var(--v-blue-deep))" },
  ],
  [
    { h: 120, bg: "linear-gradient(135deg, var(--v-yellow), var(--v-yellow-deep))" },
    { h: 180, bg: "linear-gradient(135deg, var(--v-blue), var(--v-blue-deep))", muse: "sana" },
    { h: 110, bg: "linear-gradient(135deg, var(--v-pink-soft), var(--v-pink))" },
    { h: 150, bg: "linear-gradient(135deg, var(--v-ink-soft), var(--v-ink))", muse: "momo" },
  ],
  [
    { h: 170, bg: "linear-gradient(135deg, var(--v-olive), var(--v-olive-deep))", muse: "jihyo" },
    { h: 110, bg: "linear-gradient(135deg, var(--v-pink), var(--v-pink-deep))" },
    { h: 150, bg: "linear-gradient(135deg, var(--v-yellow), var(--v-yellow-deep))", muse: "nayeon" },
    { h: 120, bg: "linear-gradient(135deg, var(--v-beige-2), var(--v-beige))" },
  ],
];

function CollageColumn({ tiles, duration, reverse }: { tiles: Tile[]; duration: string; reverse?: boolean }) {
  const doubled = [...tiles, ...tiles];
  return (
    <div className="w-full overflow-hidden">
      <div
        className="flex flex-col gap-3 motion-safe:animate-[drift_var(--drift-duration)_linear_infinite]"
        style={{ "--drift-duration": duration, animationDirection: reverse ? "reverse" : undefined } as React.CSSProperties}
      >
        {doubled.map((t, i) => (
          <div
            key={i}
            aria-hidden={i >= tiles.length}
            className="relative w-full shrink-0 overflow-hidden rounded-[var(--r-card)]"
            style={{ height: t.h, background: t.bg }}
          >
            {t.muse && (
              <span className="absolute bottom-2 left-2 rounded-[var(--r-pill)] bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                {t.muse}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[var(--ink-fixed)] text-[var(--cream-fixed)] lg:block lg:min-h-0">
      <div className="absolute inset-0 grid grid-cols-3 gap-3 p-6 opacity-90">
        <CollageColumn tiles={COLS[0]} duration="32s" />
        <CollageColumn tiles={COLS[1]} duration="40s" reverse />
        <CollageColumn tiles={COLS[2]} duration="36s" />
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.25) 45%, rgba(0,0,0,.15) 100%)" }}
      />
      <div className="absolute left-0 right-0 top-0 flex items-center gap-2 p-6">
        <span className="inline-flex size-9 items-center justify-center rounded-[var(--r-pill)] bg-[var(--cream-fixed)] font-[family-name:var(--font-display)] text-base font-bold text-[var(--ink-fixed)]">
          a
        </span>
        <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">Artchive</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 space-y-3 p-8">
        <p className="font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.05] tracking-tight">
          Every era,
          <br />
          collected.
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-white/75">
          Comebacks, stages, and predebut gems. Follow your muses and keep every photo worth saving.
        </p>
        <div className="flex items-center gap-2 pt-1 text-xs text-white/70">
          <span className="rounded-[var(--r-pill)] border border-white/25 px-2.5 py-1">12k pins saved</span>
          <span className="rounded-[var(--r-pill)] border border-white/25 px-2.5 py-1">3k muses</span>
          <span className="rounded-[var(--r-pill)] border border-white/25 px-2.5 py-1">free forever</span>
        </div>
      </div>
    </div>
  );
}


function AuthShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mode = pathname === "/signup" ? "signup" : "login";

  return (
    <div className="min-h-screen bg-[var(--v-canvas)] text-[var(--v-text)] lg:h-dvh lg:overflow-hidden">
      <style>{`@keyframes drift { from { transform: translateY(0); } to { transform: translateY(-50%); } }`}</style>
      <div className="grid min-h-screen lg:h-full lg:min-h-0 lg:grid-cols-[1.05fr_1fr] lg:grid-rows-1">
        <VisualPanel />

        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between px-5 py-4 lg:hidden">
            <Link to="/" className="flex items-center gap-2" aria-label="Artchive home">
              <span className="inline-flex size-8 items-center justify-center rounded-[var(--r-pill)] bg-[var(--v-ink)] text-sm font-bold text-[var(--v-on-ink)]">
                a
              </span>
              <span className="font-[family-name:var(--font-display)] text-lg font-semibold">Artchive</span>
            </Link>
            <Link to="/" className="text-sm text-[var(--v-text-2)] underline-offset-2 hover:underline">
              Explore first
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 overflow-hidden px-5 lg:hidden" aria-hidden="true">
            {COLS.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-2">
                {col.slice(0, 2).map((t, i) => (
                  <div
                    key={i}
                    className="relative w-full overflow-hidden rounded-[var(--r-card-sm)]"
                    style={{ height: Math.round(t.h * 0.55), background: t.bg }}
                  >
                    {t.muse && (
                      <span className="absolute bottom-1.5 left-1.5 rounded-[var(--r-pill)] bg-black/45 px-1.5 py-px text-[10px] font-medium text-white">
                        {t.muse}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex-1 px-5 py-8 lg:min-h-0 lg:overflow-y-auto lg:py-6">
            <div className="mx-auto flex min-h-full w-full max-w-sm items-start justify-center lg:pt-12">
              <div className="w-full">
                {/* Mounted once for both auth pages, so the lens glides on switch. */}
                <Tabs
                  variant="lenses"
                  value={mode}
                  onValueChange={(v) => navigate({ to: v === "login" ? "/login" : "/signup" })}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="login" className="flex-1 justify-center">Sign in</TabsTrigger>
                    <TabsTrigger value="signup" className="flex-1 justify-center">Join</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* key remounts per page so each navigation plays the entrance */}
                <MotionSurface asChild key={pathname} preset="rise">
                  <div className="w-full">
                    <Outlet />
                  </div>
                </MotionSurface>

                <GoogleButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
