import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  Compass,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";
import { Icon, IconButton } from "@/components/ui/icon";
import {
  Sidebar,
  SidebarContent,
  SidebarMenuButton,
  SidebarMenuLabel,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { motion } from "motion/react";
import { useChoreography } from "@/lib/cojeev-motion/choreography";
import { useFlowGroup } from "@/lib/cojeev-motion/use-flow";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { feedback } from "@/components/ui/toaster";
import { humanizeAuthError } from "@/lib/feedback";
import { getIsAdmin } from "@/lib/admin-flag";
import {
  AdminNavButton,
  CreatePinDialog,
  NotificationsBell,
  openCreatePin,
  useSessionUser,
} from "@/components/app-shell";
import { SearchPopover } from "@/components/search-popover";
import { logout } from "@/lib/queries";

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Artchive home">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--r-pill)] bg-[var(--v-pink)] font-[family-name:var(--font-display)] text-sm font-bold text-[var(--v-on-accent)]">
        a
      </span>
      {!compact && (
        <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
          Artchive
        </span>
      )}
    </Link>
  );
}

const NAV = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/search", label: "Browse", icon: Compass, exact: false },
  { to: "/saved", label: "Saved", icon: Bookmark, exact: true },
  { to: "/updates", label: "Updates", icon: Bell, exact: true },
] as const;

// The bar owns the flow group, so its selectors stay module-level and the
// attach callback keeps one identity across renders (no re-seat per render).
const BOTTOM_TAB_FLOW = {
  itemSelector: '[data-slot="bottom-tab"]',
  activeSelector: '[aria-current="page"]',
};

export function RailProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<boolean>(() =>
    typeof localStorage === "undefined" ? true : localStorage.getItem("rail") !== "mini",
  );

  return (
    <SidebarProvider
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        try {
          localStorage.setItem("rail", next ? "full" : "mini");
        } catch {}
      }}
    >
      {children}
    </SidebarProvider>
  );
}

const MotionSidebar = motion.create(Sidebar);

function DockTip({ label, children }: { label: string; children: React.ReactNode }) {
  const { open } = useSidebar();
  if (open) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar() {
  const { open } = useSidebar();
  const { quiet, transition } = useChoreography();

  return (
    <TooltipProvider>
      <MotionSidebar
      layout="viewport"
      className={`sticky top-4 hidden h-[calc(100dvh-2rem)] border border-[var(--structure-line)] transition-none! lg:flex ${open ? "w-60" : ""}`}
      initial={false}
      animate={{ width: open ? 240 : 76 }}
      transition={quiet ? { duration: 0 } : transition}
    >
      <RailInner />
    </MotionSidebar>
    </TooltipProvider>
  );
}

function RailInner() {
  const { open } = useSidebar();
  const matchRoute = useMatchRoute();

  return (
    <>
      <div className={`flex h-20 shrink-0 items-center justify-start ${open ? "px-2" : "px-1.5"}`}>
        <BrandMark compact={!open} />
      </div>
      <div className="flex justify-center px-1 pb-1">
        {open ? (
          <Button variant="accent" className="w-full" onClick={() => openCreatePin()} aria-label="Create pin">
            <Plus className="size-4 shrink-0" />
            <span>Create</span>
          </Button>
        ) : (
          <DockTip label="Create pin">
            <button
              type="button"
              onClick={() => openCreatePin()}
              aria-label="Create pin"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--v-pink)] text-[var(--v-on-accent)]"
            >
              <Plus className="size-5" />
            </button>
          </DockTip>
        )}
      </div>
      <SidebarContent>
        {NAV.map(({ to, label, icon: Icon, exact }) => (
          <DockTip key={to} label={label}>
            <SidebarMenuButton
              asChild
              isActive={!!matchRoute({ to, exact })}
              label={label}
            >
              <Link to={to}>
                <Icon className="size-4 shrink-0" />
                <SidebarMenuLabel>{label}</SidebarMenuLabel>
              </Link>
            </SidebarMenuButton>
          </DockTip>
        ))}
      </SidebarContent>
    </>
  );
}

function UserMenu() {
  const { data: user } = useSessionUser();
  const { data: isAdmin } = useQuery({
    queryKey: ["isAdmin", user?.id],
    queryFn: getIsAdmin,
    enabled: !!user,
    staleTime: 60_000,
  });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const out = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      feedback.show("Signed out", { description: "See you soon." });
      qc.clear();
      navigate({ to: "/" });
    },
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  if (!user) {
    return (
      <Button asChild variant="accent" size="sm">
        <Link to="/login">Sign in</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="inline-flex shrink-0 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--v-brand)]"
        >
          <Avatar size="sm">
            {user.image ? <AvatarImage src={user.image} /> : null}
            <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar>
            {user.image ? <AvatarImage src={user.image} /> : null}
            <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-[var(--v-text-2)]">@{user.username}</p>
            <Link
              to="/u/$username"
              params={{ username: user.username }}
              className="mt-0.5 inline-block text-xs font-medium text-[var(--v-brand)] hover:underline"
            >
              View your profile
            </Link>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Icon name="settings" size="sm" />
            Settings
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <Icon name="shield" size="sm" />
              Admin dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => out.mutate()} disabled={out.isPending}>
          <Icon name="log-out" size="sm" />
          {out.isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppTopbar() {
  const { open, setOpen } = useSidebar();

  return (
    <div className="sticky top-0 z-30 hidden items-center gap-2 border-b border-[var(--v-border)] bg-[var(--v-canvas)]/90 py-3 backdrop-blur lg:flex">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fold sidebar" : "Unfold sidebar"}
        aria-expanded={open}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--v-text-2)] transition-colors hover:bg-[var(--v-beige)] hover:text-[var(--v-text)]"
      >
        {open ? <PanelLeftClose className="size-5" /> : <PanelLeftOpen className="size-5" />}
      </button>
      <SearchPopover variant="field" />
      <NotificationsBell />
      <UserMenu />
    </div>
  );
}

export function MobileTopbar() {
  const { data: user } = useSessionUser();
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--v-border)] bg-[var(--v-canvas)]/90 py-2.5 backdrop-blur lg:hidden">
      <AdminNavButton />
      <BrandMark />
      <span className="flex-1" />
      <SearchPopover variant="icon" />
      {user ? (
        <>
          <NotificationsBell />
          <UserMenu />
        </>
      ) : (
        <Button asChild variant="accent" size="sm">
          <Link to="/login">Sign in</Link>
        </Button>
      )}
    </div>
  );
}

export function BottomTabs() {
  const matchRoute = useMatchRoute();
  const flowRef = useFlowGroup<HTMLDivElement>(undefined, BOTTOM_TAB_FLOW);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--v-border)] bg-[var(--v-canvas)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div
          ref={flowRef}
          data-flow-group=""
          className="flex min-w-0 flex-1 [--glide-fg:var(--v-pink)] dark:[--glide-ring:inset_0_0_0_1px_var(--structure-line)]"
        >
          {NAV.map(({ to, label, icon: ItemIcon, exact }) => (
            <Link
              key={to}
              to={to}
              data-slot="bottom-tab"
              aria-current={matchRoute({ to, exact }) ? "page" : undefined}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--r-md)] px-1 py-1.5 text-[length:var(--fs-meta)] font-medium text-[var(--v-text-2)] outline-none aria-[current=page]:text-[var(--v-pink)] focus-visible:ring-2 focus-visible:ring-[var(--v-brand)]"
            >
              <ItemIcon className="size-5 shrink-0" />
              <span className="w-full truncate text-center leading-none">{label}</span>
            </Link>
          ))}
        </div>
        <IconButton
          variant="pink"
          size="lg"
          aria-label="Create pin"
          onClick={() => openCreatePin()}
        >
          <Plus className="size-5" />
        </IconButton>
      </div>
    </nav>
  );
}

/** Mount once per app shell. Opened via openCreatePin(). */
export function CreatePinMount() {
  return <CreatePinDialog />;
}
