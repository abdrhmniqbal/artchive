import { useCallback, useEffect, useState } from "react";
import { Outlet, createFileRoute, Link, redirect, useMatchRoute } from "@tanstack/react-router";
import { AlertTriangle, Image as ImageIcon, LayoutDashboard, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar.tsx";
import { MotionDrawer } from "@/components/ui/motion-drawer.tsx";
import { setAdminNavTrigger } from "@/lib/admin-nav-store";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: async () => {
    const { getIsAdmin } = await import("@/lib/admin-flag");
    if (!(await getIsAdmin())) throw redirect({ to: "/" });
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/moderation", label: "Moderation", icon: AlertTriangle },
  { to: "/admin/content", label: "Content", icon: ImageIcon },
  { to: "/admin/audience", label: "Audience", icon: Users },
] as const;

function AdminNav({ matchRoute }: { matchRoute: ReturnType<typeof useMatchRoute> }) {
  return (
    <SidebarContent>
      {NAV.map(({ to, label, icon: Icon, ...rest }) => (
        <SidebarMenuButton
          key={to}
          asChild
          isActive={!!matchRoute({ to, ...(rest as { exact?: boolean }) })}
          label={label}
        >
          <Link to={to}>
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        </SidebarMenuButton>
      ))}
    </SidebarContent>
  );
}

function AdminLayout() {
  const matchRoute = useMatchRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  useEffect(() => {
    setAdminNavTrigger(openDrawer);
    return () => setAdminNavTrigger(null);
  }, [openDrawer]);
  return (
    <div className="flex gap-6">
      {/* desktop sidebar */}
      <SidebarProvider>
        <Sidebar className="sticky top-6 hidden h-fit md:flex">
          <AdminNav matchRoute={matchRoute} />
        </Sidebar>
      </SidebarProvider>

      <div className="min-w-0 flex-1">
        <MotionDrawer
          title=""
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          side="start"
          width={280}
          trigger={<span aria-hidden="true" className="hidden" />}
        >
          <AdminNav matchRoute={matchRoute} />
        </MotionDrawer>
        <Outlet />
      </div>
    </div>
  );
}
