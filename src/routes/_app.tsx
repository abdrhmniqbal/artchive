import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { MotionSurface } from "@/components/ui/presence";
import { AppSidebar, AppTopbar, BottomTabs, CreatePinMount, MobileTopbar, RailProvider } from "@/components/app-nav";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <RailProvider>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-4 bg-[var(--v-canvas)] px-4 text-[var(--v-text)]">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col pb-24 lg:pb-0">
          <MobileTopbar />
          <AppTopbar />
          <main className="min-w-0 flex-1 py-4">
            <MotionSurface key={pathname} preset="fade">
              <Outlet />
            </MotionSurface>
          </main>
          <BottomTabs />
        </div>
        <CreatePinMount />
      </div>
    </RailProvider>
  );
}
