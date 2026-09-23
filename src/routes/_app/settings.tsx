import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  FlaskConical,
  Loader2,
  Lock,
  Monitor,
  Moon,
  Palette,
  Sun,
  User,
  UserCog,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MotionControls } from "@/components/ui/adjuster";
import { PasswordField } from "@/components/password-field";
import { feedback } from "@/components/ui/toaster";
import { fieldError } from "@/lib/auth-forms";
import { useIsPhone } from "@/hooks/use-media-query";
import { humanizeAuthError } from "@/lib/feedback";
import { me, updateMe, changePassword, deleteAccount } from "@/lib/queries";
import { uploadToAnonDrop } from "@/components/app-shell";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

type ThemeMode = "light" | "dark" | "system";
type Section = "profile" | "account" | "appearance" | "beta";


function applyTheme(mode: ThemeMode) {
  const resolved =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  document.documentElement.dataset.mode = resolved;
}

function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("theme") : null;
    return stored === "light" || stored === "dark" ? stored : "system";
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem("theme") ?? "system") === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const change = (next: ThemeMode) => {
    setMode(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  };

  return { mode, change };
}


function IdentityHero({ onAvatar }: { onAvatar: () => void }) {
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: me, staleTime: 30_000 });

  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        onClick={onAvatar}
        aria-label="Change avatar"
        className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--v-brand)]"
      >
        <Avatar size="lg">
          {user?.image ? <AvatarImage src={user.image} /> : null}
          <AvatarFallback>{user ? user.name.slice(0, 2).toUpperCase() : "?"}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 inline-flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
          <Camera className="size-5" />
        </span>
      </button>
      <div className="min-w-0">
        <p className="truncate font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
          {user?.name ?? "Loading"}
        </p>
        <p className="truncate text-sm text-[var(--v-text-2)]">
          @{user?.username ?? "…"} · {user?.email ?? ""}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs">
          {user?.emailVerified ? (
            <span className="inline-flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
              <BadgeCheck className="size-3.5" /> Email verified
            </span>
          ) : (
            <span className="text-[var(--v-text-2)]">Email not verified yet</span>
          )}
          {user && (
            <Link
              to="/u/$username"
              params={{ username: user.username }}
              className="ml-2 underline underline-offset-2 hover:text-[var(--v-text)]"
            >
              View public profile
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}


const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your display name.").max(60),
  bio: z.string().trim().max(200, "Keep bios under 200 characters."),
});

function ProfileSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: me, staleTime: 30_000 });

  const save = useMutation({
    mutationFn: (value: { name: string; bio: string }) =>
      updateMe({ data: { name: value.name, bio: value.bio } }),
    onSuccess: () => {
      feedback.show("Profile saved", { description: "Your public profile is up to date." });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  const form = useForm({
    defaultValues: { name: user?.name ?? "", bio: user?.bio ?? "" },
    validators: { onSubmit: profileSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });

  return (
    <Card variant="panel" className="p-5 sm:p-6" key={userId}>
      <h2 className="text-sm font-semibold">Public profile</h2>
      <p className="mb-4 text-xs text-[var(--v-text-2)]">How you appear across Artchive.</p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Field name="name" validators={{ onChange: profileSchema.shape.name }}>
          {(field) => (
            <Field>
              <FieldLabel htmlFor="profile-name">Display name</FieldLabel>
              <Input
                id="profile-name"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                maxLength={60}
                required
              />
              {fieldError(field) ? <FieldError>{fieldError(field)}</FieldError> : null}
            </Field>
          )}
        </form.Field>

        <form.Field name="bio" validators={{ onChange: profileSchema.shape.bio }}>
          {(field) => (
            <Field>
              <FieldLabel htmlFor="profile-bio">Bio</FieldLabel>
              <Textarea
                id="profile-bio"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Collector of comebacks and predebut gems."
                rows={3}
                maxLength={200}
              />
              {fieldError(field) ? <FieldError>{fieldError(field)}</FieldError> : null}
            </Field>
          )}
        </form.Field>

        <div className="grid gap-3 rounded-[var(--r-card)] border border-[var(--v-border)] p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-[var(--v-text-2)]">
              Username <Lock className="size-3" />
            </p>
            <p className="mt-0.5 font-medium">@{user?.username}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[var(--v-text-2)]">
              Email <Lock className="size-3" />
            </p>
            <p className="mt-0.5 truncate font-medium">{user?.email}</p>
          </div>
          <p className="text-xs text-[var(--v-text-2)] sm:col-span-2">
            Usernames and emails are permanent. Talk to us if you need a change.
          </p>
        </div>

        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <div>
              <Button size="sm" type="submit" disabled={!canSubmit} loading={isSubmitting || save.isPending}>
                Save changes
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </Card>
  );
}


const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string().min(1, "Repeat the new password."),
  })
  .refine((v) => v.next === v.confirm, { message: "The two passwords do not match.", path: ["confirm"] });

function AccountSection() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: me, staleTime: 30_000 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const remove = useMutation({
    mutationFn: () => deleteAccount({ data: { confirmUsername: confirmName, password: deletePassword || undefined } }),
    onSuccess: () => {
      setDialogOpen(false);
      qc.clear();
      feedback.show("Account deleted", { description: "Sorry to see you go." });
      navigate({ to: "/" });
    },
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  const canDelete = user && confirmName.trim().toLowerCase() === user.username.toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <Card variant="panel" className="p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Password</h2>
        <p className="mb-4 text-xs text-[var(--v-text-2)]">Change the password you sign in with.</p>
        <PasswordForm />
      </Card>

      <Card variant="panel" className="border-[var(--v-danger)] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-[var(--v-danger-ink)]">Danger zone</h2>
        <p className="mb-4 text-xs text-[var(--v-text-2)]">
          Deleting your account removes your profile, pins, boards, and everything attached to them. This cannot be undone.
        </p>
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="danger">
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex min-w-0 flex-col gap-1.5">
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every pin, board, and comment under @{user?.username} will be permanently removed.
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="delete-confirm">Type your username to confirm</FieldLabel>
                <Input
                  id="delete-confirm"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={user?.username ?? "username"}
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="delete-password">Current password (if you have one)</FieldLabel>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Only for password accounts"
                />
              </Field>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button size="sm" variant="secondary">
                  Keep my account
                </Button>
              </AlertDialogCancel>
              <Button
                size="sm"
                variant="danger"
                disabled={!canDelete}
                loading={remove.isPending}
                onClick={() => remove.mutate()}
              >
                Delete everything
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
}

function PasswordForm() {
  const m = useMutation({
    mutationFn: (value: { current: string; next: string }) =>
      changePassword({ data: { currentPassword: value.current, newPassword: value.next } }),
    onSuccess: () => {
      feedback.show("Password updated", { description: "Other sessions were signed out." });
      form.reset();
    },
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  const form = useForm({
    defaultValues: { current: "", next: "", confirm: "" },
    validators: { onSubmit: passwordSchema },
    onSubmit: async ({ value }) => {
      await m.mutateAsync({ current: value.current, next: value.next });
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
        <form.Field name="current" validators={{ onChange: passwordSchema.shape.current }}>
          {(field) => (
            <PasswordField
              id="settings-current"
              label="Current password"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field)}
              autoComplete="current-password"
            />
          )}
        </form.Field>
        <form.Field name="next" validators={{ onChange: passwordSchema.shape.next }}>
          {(field) => (
            <PasswordField
              id="settings-new"
              label="New password"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field)}
              autoComplete="new-password"
              placeholder="8+ characters"
              minLength={8}
            />
          )}
        </form.Field>
        <form.Field
          name="confirm"
          validators={{
            onChangeListenTo: ["next"],
            onChange: passwordSchema.shape.confirm,
          }}
        >
          {(field) => (
            <PasswordField
              id="settings-confirm"
              label="Confirm new password"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field)}
              autoComplete="new-password"
              minLength={8}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <div>
              <Button size="sm" type="submit" disabled={!canSubmit} loading={isSubmitting || m.isPending}>
                Update password
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
  );
}


/* Literal theme values mirroring tokens.css (:root for light,
   the [data-mode="dark"] override for dark). Nested data-mode scoping does
   not work because the tokens are :root-scoped, so previews paint literally. */
const THEME_PAINT = {
  light: { canvas: "#FBF4E6", ink: "#111111", soft: "#EEE7DA", line: "#D9D2C4", accent: "#F5B8DB" },
  dark: { canvas: "#171512", ink: "#FBF4E6", soft: "#2A2621", line: "#3A352E", accent: "#F5B8DB" },
} as const;

function ThemeMock({ theme }: { theme: keyof typeof THEME_PAINT }) {
  const p = THEME_PAINT[theme];
  return (
    <span className="flex h-full w-full flex-col gap-1.5 p-2.5" style={{ background: p.canvas }} aria-hidden="true">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-full" style={{ background: p.ink }} />
        <span className="h-1.5 w-10 rounded-full" style={{ background: p.soft }} />
        <span className="ml-auto h-3.5 w-8 rounded-full" style={{ background: p.accent }} />
      </span>
      <span className="h-1.5 w-full rounded-full" style={{ background: p.soft }} />
      <span className="h-1.5 w-2/3 rounded-full" style={{ background: p.line }} />
    </span>
  );
}

const THEMES = [
  { value: "system", icon: Monitor, label: "System", hint: "Follow your device" },
  { value: "light", icon: Sun, label: "Light", hint: "Bright paper look" },
  { value: "dark", icon: Moon, label: "Dark", hint: "Low-light friendly" },
] as const;

function AppearanceSection() {
  const { mode, change } = useThemeMode();

  return (
    <Card variant="panel" className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold">Appearance</h2>
      <p className="mb-4 text-xs text-[var(--v-text-2)]">How Artchive looks on this device.</p>
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
        {THEMES.map(({ value, icon: Icon, label, hint }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => change(value)}
              className={`overflow-hidden rounded-[var(--r-card)] border text-left transition-colors ${
                active
                  ? "border-[var(--v-brand)]"
                  : "border-[var(--v-border)] hover:bg-[var(--v-beige)]"
              }`}
            >
              <span className="block h-20 overflow-hidden" aria-hidden="true">
                {value === "system" ? (
                  <span className="grid h-full grid-cols-2">
                    <ThemeMock theme="light" />
                    <ThemeMock theme="dark" />
                  </span>
                ) : (
                  <ThemeMock theme={value} />
                )}
              </span>
              <span className="flex items-center gap-2 p-3 text-sm font-medium">
                <Icon className="size-4" />
                {label}
                {active && <span className="ml-auto size-2 rounded-full bg-[var(--v-brand)]" />}
              </span>
              <span className="-mt-1 block px-3 pb-3 text-xs text-[var(--v-text-2)]">{hint}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-6 border-t border-[var(--v-border)] pt-5">
        <h3 className="text-sm font-semibold">Motion</h3>
        <p className="mb-4 text-xs text-[var(--v-text-2)]">
          How the interface moves. Saved on this device, applied everywhere.
        </p>
        <MotionControls />
      </div>
    </Card>
  );
}


function BetaSection() {
  const qc = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: me, staleTime: 30_000 });
  const toggleNsfw = useMutation({
    mutationFn: (v: boolean) => updateMe({ data: { showNsfw: v } }),
    onSuccess: () => {
      feedback.show("Preference saved");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  return (
    <Card variant="panel" className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold">Beta features</h2>
      <p className="mb-4 text-xs text-[var(--v-text-2)]">Early experiments for admins. These may change or disappear.</p>
      <label className="flex items-center justify-between gap-4 rounded-[var(--r-card)] border border-[var(--v-border)] p-4">
        <span>
          <span className="block text-sm font-medium">Show NSFW pins</span>
          <span className="block text-xs text-[var(--v-text-2)]">Reveal pins marked as NSFW across the feed and search.</span>
        </span>
        <Switch
          checked={!!user?.showNsfw}
          onCheckedChange={(v) => toggleNsfw.mutate(v)}
          disabled={toggleNsfw.isPending}
          aria-label="Show NSFW pins"
        />
      </label>
    </Card>
  );
}


const NAV: { id: Section; icon: typeof User; title: string; hint: string; adminOnly?: boolean }[] = [
  { id: "profile", icon: User, title: "Profile", hint: "Name, bio, avatar" },
  { id: "account", icon: UserCog, title: "Account", hint: "Password, delete account" },
  { id: "appearance", icon: Palette, title: "Appearance", hint: "Theme on this device" },
  { id: "beta", icon: FlaskConical, title: "Beta", hint: "Admin experiments", adminOnly: true },
];

function SettingsPage() {
  const qc = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: me, staleTime: 30_000 });
  const [section, setSection] = useState<Section>("profile");
  // rail on desktop, underline on phones (rail first for SSR, hook corrects)
  const variant = useIsPhone() ? "underline" : "rail";
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === "admin";
  const visibleNav = NAV.filter((n) => !n.adminOnly || isAdmin);

  async function onAvatarPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadToAnonDrop(file);
      await updateMe({ data: { image: url } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      feedback.show("Avatar updated");
    } catch {
      feedback.error("Upload failed", { description: "Try a different image." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" aria-label="Back to feed">
          <Link to="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
            Settings
          </h1>
          <p className="text-sm text-[var(--v-text-2)]">Manage your account and how Artchive looks.</p>
        </div>
      </header>

      <div className="mb-6">
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onAvatarPicked} />
        <div className="relative">
          <IdentityHero onAvatar={() => fileInput.current?.click()} />
          {uploading && (
            <span className="absolute left-0 top-0 inline-flex size-[110px] items-center justify-center rounded-full bg-black/45 text-white">
              <Loader2 className="size-5 animate-spin" />
            </span>
          )}
        </div>
      </div>

      <Tabs
        variant={variant}
        value={section}
        onValueChange={(v) => setSection(v as Section)}
        className="mt-6"
      >
        <TabsList aria-label="Settings sections">
          {visibleNav.map(({ id, icon: Icon, title, hint }) => (
            <TabsTrigger key={id} value={id}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{title}</span>
                <span className="hidden text-xs text-[var(--v-text-2)] md:block">{hint}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profile">
          {user ? <ProfileSection userId={user.id} /> : <ProfileSkeleton />}
        </TabsContent>
        <TabsContent value="account">
          <AccountSection />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceSection />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="beta">
            <BetaSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <Card variant="panel" className="space-y-3 p-5 sm:p-6">
      <div className="h-4 w-40 animate-pulse rounded bg-[var(--v-border)]" />
      <div className="h-10 w-full animate-pulse rounded bg-[var(--v-border)]" />
      <div className="h-20 w-full animate-pulse rounded bg-[var(--v-border)]" />
    </Card>
  );
}
