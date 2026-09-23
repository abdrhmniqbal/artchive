import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAdminNavTrigger } from "@/lib/admin-nav-store";
import { fieldError } from "@/lib/auth-forms";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody, DialogClose } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Alert, AlertIcon, AlertBody, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dropzone as CojeevDropzone } from "@/components/ui/dropzone";
import { Icon, IconButton } from "@/components/ui/icon";
import { Item, ItemContent, ItemGroup, ItemTitle, ItemTrailing } from "@/components/ui/item";
import { MotionSurface } from "@/components/ui/presence";
import {
  CollectionField, DescriptionField, MuseCombobox, NsfwField, SourceField, TagsField, TitleField,
  musesField, titleField,
} from "@/components/pin-fields";
import { track } from "@/lib/analytics";
import { me,
  createPin,
  myCollections,
  createCollection,
  saveToCollection,
  toggleLike,
  type FeedPin, getNotifications, markNotificationsRead } from "@/lib/queries";

/* ------------------------------ top-level nav ----------------------------- */

export function useSessionUser() {
  return useQuery({ queryKey: ["me"], queryFn: me, staleTime: 30_000 });
}

export function AdminNavButton() {
  const openDrawer = useAdminNavTrigger();
  if (!openDrawer) return null;
  return (
    <button
      type="button"
      aria-label="Open admin menu"
      onClick={openDrawer}
      className="inline-flex size-9 items-center justify-center rounded-[var(--r-pill)] text-[var(--v-text)] hover:bg-[var(--v-beige)] md:hidden"
    >
      <Icon name="menu" />
    </button>
  );
}


/* ------------------------------ upload (AnonDrop) ------------------------- */

/* Uploads go through our server proxy (/api/upload) so the AnonDrop
   key stays in server env (ANONDROP_KEY) and never ships to the browser. */

async function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

export async function uploadToAnonDrop(file: File): Promise<{ url: string; width: number; height: number }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  const { link, filename } = (await res.json()) as { link: string; filename: string };
  // AnonDrop serves the file only under its ORIGINAL filename: <id>/<name>
  const direct = `${link}/${encodeURIComponent(filename ?? file.name)}`;
  const dims = await measureImage(direct).catch(() => null);
  if (!dims) throw new Error("Upload failed");
  return { url: direct, ...dims };
}

async function useRemoteImage(url: string): Promise<{ url: string; width: number; height: number } | null> {
  try {
    new URL(url);
  } catch {
    return null;
  }
  const dims = await measureImage(url).catch(() => null);
  if (!dims) return null;
  return { url, ...dims };
}

/* ------------------------------ create pin -------------------------------- */

type Media = { url: string; width: number; height: number };

function Dropzone({
  media,
  uploading,
  error,
  onFile,
  onRemote,
  onClear,
}: {
  media: Media | null;
  uploading: boolean;
  error: string | null;
  onFile: (f: File) => void;
  onRemote: (url: string) => void;
  onClear: () => void;
}) {
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteOpen, setRemoteOpen] = useState(false);

  if (media) {
    return (
      <div className="relative overflow-hidden rounded-[var(--r-card-sm)] border border-[var(--v-border)]">
        <img
          src={media.url}
          alt="preview"
          className="max-h-[420px] w-full object-cover"
          style={media.width && media.height ? { aspectRatio: `${media.width}/${media.height}` } : undefined}
        />
        <IconButton
          type="button"
          aria-label="Remove image"
          variant="ink"
          size="sm"
          className="absolute right-2 top-2"
          onClick={onClear}
        >
          <Icon name="x" />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <CojeevDropzone
        accept="image/*"
        multiple={false}
        maxSize={10 * 1024 * 1024}
        disabled={uploading}
        onFilesSelected={(files) => {
          const f = files[0];
          if (f) onFile(f);
        }}
      />
      {uploading && (
        <p className="flex items-center gap-2 text-sm text-[var(--v-text-2)]">
          <Icon name="loader-circle" size="sm" className="animate-spin" /> Uploading…
        </p>
      )}
      {error && (
        <Alert variant="danger">
          <AlertBody>
            <AlertDescription>{error}</AlertDescription>
          </AlertBody>
        </Alert>
      )}
      {remoteOpen ? (
        <div className="flex gap-2">
          <Input value={remoteUrl} placeholder="https://… image URL" onChange={(e) => setRemoteUrl(e.target.value)} />
          <Button size="sm" variant="secondary" disabled={!remoteUrl.trim()} onClick={() => onRemote(remoteUrl.trim())}>
            Use
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" type="button" onClick={() => setRemoteOpen(true)}>
          <Icon name="link" /> Or use a remote image URL
        </Button>
      )}
    </div>
  );
}

/* ------------------------- create-pin open state ------------------------ */

let createPinOpen = false;
const createPinListeners = new Set<() => void>();

function setCreatePinOpen(next: boolean) {
  createPinOpen = next;
  for (const l of createPinListeners) l();
}

/** Open the create-pin dialog from anywhere (sidebar, topbar, bottom tabs). */
export function openCreatePin() {
  setCreatePinOpen(true);
}

function useCreatePinOpen() {
  const [open, setOpen] = useState(createPinOpen);
  useEffect(() => {
    const onChange = () => setOpen(createPinOpen);
    createPinListeners.add(onChange);
    onChange();
    return () => {
      createPinListeners.delete(onChange);
    };
  }, []);
  return [open, setCreatePinOpen] as const;
}

const PIN_DEFAULTS = {
  title: "",
  description: "",
  sourceUrl: "",
  media: null as Media | null,
  muses: [] as string[],
  tags: [] as string[],
  collectionId: "" as string,
  isNsfw: false,
};

function CreatePinDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useCreatePinOpen();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: collections } = useQuery({ queryKey: ["collections"], queryFn: myCollections, enabled: open });
  const { data: meUser } = useQuery({ queryKey: ["me"], queryFn: me, enabled: open, staleTime: 30_000 });
  const isAdmin = meUser?.role === "admin";

  const form = useForm({
    defaultValues: PIN_DEFAULTS,
    onSubmit: async ({ value }) => {
      if (!value.media || !value.muses.length) return;
      await create.mutateAsync({
        title: value.title,
        description: value.description || undefined,
        imageUrl: value.media.url,
        width: value.media.width,
        height: value.media.height,
        sourceUrl: value.sourceUrl || undefined,
        museTags: value.muses,
        tags: value.tags,
        collectionId: value.collectionId || undefined,
        isNsfw: value.isNsfw || undefined,
      });
      form.reset();
    },
  });

  const create = useMutation({
    mutationFn: (v: {
      title: string;
      description?: string;
      imageUrl: string;
      width?: number;
      height?: number;
      sourceUrl?: string;
      museTags: string[];
      tags: string[];
      collectionId?: string;
      isNsfw?: boolean;
    }) => createPin({ data: v }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["museSearch"] });
      qc.invalidateQueries({ queryKey: ["topMuses"] });
      setOpen(false);
      setUploadError(null);
      navigate({ to: "/pin/$id", params: { id: res.id } });
    },
  });

  async function onFile(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const m = await uploadToAnonDrop(file);
      form.setFieldValue("media", m);
    } catch {
      setUploadError("Upload failed. Try again or use a remote URL.");
    } finally {
      setUploading(false);
    }
  }

  async function onRemote(url: string) {
    setUploadError(null);
    setUploading(true);
    const m = await useRemoteImage(url);
    setUploading(false);
    if (!m) {
      setUploadError("Couldn't load that image URL.");
      return;
    }
    form.setFieldValue("media", m);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        style={{ width: "min(900px, calc(100% - 24px))" }}
        className="[max-height:calc(100dvh_-_24px)] [overflow:auto]"
      >
        <DialogHeader>
          <DialogTitle>New pin</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <DialogBody className="v-dialog__split" style={{ "--h": "min(720px, calc(100dvh - 230px))" }}>
            <form.Subscribe selector={(s) => s.values.media}>
              {(media) => (
                <div className="flex w-full flex-col gap-3 self-start rounded-[var(--r-card)] bg-[var(--v-beige)] p-4">
                  <Dropzone
                    media={media}
                    uploading={uploading}
                    error={uploadError}
                    onFile={onFile}
                    onRemote={onRemote}
                    onClear={() => form.setFieldValue("media", null)}
                  />
                </div>
              )}
            </form.Subscribe>

            <div className="flex min-w-0 flex-col gap-4">
              <form.Field name="title" validators={{ onChange: titleField }}>
                {(field) => (
                  <TitleField
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                    error={fieldError(field)}
                  />
                )}
              </form.Field>

              <form.Field name="description">
                {(field) => (
                  <DescriptionField
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>

              <form.Field name="muses" validators={{ onChange: musesField, onSubmit: musesField }}>
                {(field) => (
                  <MuseCombobox
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    error={fieldError(field)}
                  />
                )}
              </form.Field>

              <form.Subscribe selector={(s) => s.values.tags}>
                {(tags) => <TagsField value={tags} onChange={(v) => form.setFieldValue("tags", v)} />}
              </form.Subscribe>

              <form.Field name="sourceUrl">
                {(field) => (
                  <SourceField
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>

              <form.Subscribe selector={(s) => s.values.collectionId}>
                {(collectionId) => (
                  <CollectionField
                    value={collectionId}
                    onChange={(v) => form.setFieldValue("collectionId", v)}
                    collections={collections}
                  />
                )}
              </form.Subscribe>
              {isAdmin && (
                <form.Subscribe selector={(s) => s.values.isNsfw}>
                  {(isNsfw) => (
                    <NsfwField checked={isNsfw} onChange={(v) => form.setFieldValue("isNsfw", v)} />
                  )}
                </form.Subscribe>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="lg" type="button">
                Cancel
              </Button>
            </DialogClose>
            <form.Subscribe selector={(s) => !s.canSubmit || s.isSubmitting || s.values.muses.length === 0}>
              {(disabled) => (
                <Button
                  variant="accent"
                  size="lg"
                  type="submit"
                  loading={create.isPending || uploading}
                  disabled={disabled}
                >
                  Pin it
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { CreatePinDialog, MuseCombobox };

/* ------------------------------- save dialog ------------------------------ */

export function SaveToCollectionDialog({
  pinId,
  saved,
  onSaved,
}: {
  pinId: string;
  saved?: boolean;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const { data: collections } = useQuery({ queryKey: ["collections"], queryFn: myCollections, enabled: open });
  const createCol = useMutation({
    mutationFn: (v: { name: string; description?: string }) => createCollection({ data: v }),
    onSuccess: (c) => save.mutate({ collectionId: c.id, pinId }),
  });
  const save = useMutation({
    mutationFn: (v: { collectionId: string; pinId: string }) => saveToCollection({ data: v }),
    onSuccess: (_d, v2) => {
      try { localStorage.setItem("artchive:lastBoard", v2.collectionId); } catch {}
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["pin"] });
      onSaved?.();
    },
  });
  let lastBoardId: string | null = null;
  try { lastBoardId = localStorage.getItem("artchive:lastBoard"); } catch {}
  const orderedCollections = lastBoardId
    ? [...(collections ?? [])].sort((a, b) => (a.id === lastBoardId ? -1 : b.id === lastBoardId ? 1 : 0))
    : collections ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={saved ? "accent" : "secondary"} size="sm">
          {saved ? "Saved" : "Save"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save to collection</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex max-h-80 flex-col gap-2 overflow-auto">
          <ItemGroup>
            {orderedCollections.map((c) => (
              <Item key={c.id} onClick={() => save.mutate({ collectionId: c.id, pinId })}>
                <ItemContent>
                  <ItemTitle>
                    {c.name}
                    {c.id === lastBoardId && <span className="ml-1.5 text-xs font-normal text-[var(--v-text-2)]">· last used</span>}
                  </ItemTitle>
                </ItemContent>
                <ItemTrailing>{c.pinCount} pins</ItemTrailing>
              </Item>
            ))}
          </ItemGroup>
          {!collections?.length && <p className="text-sm text-[var(--v-text-2)]">No collections yet. Create one:</p>}
          <div className="mt-2 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection name" />
            <Button
              size="sm"
              disabled={!name.trim()}
              loading={createCol.isPending || save.isPending}
              onClick={() => createCol.mutate({ name: name.trim() })}
            >
              Create
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- masonry feed card ---------------------------- */

export function FeedCard({ pin }: { pin: FeedPin }) {
  const qc = useQueryClient();
  const { data: user } = useSessionUser();
  const like = useMutation({
    mutationFn: () => toggleLike({ data: pin.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["pin", pin.id] });
    },
  });

  return (
    <div className="group relative block break-inside-avoid overflow-hidden rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] transition-shadow hover:shadow-md">
      <Link to="/pin/$id" params={{ id: pin.id }}>
        <img
          src={pin.imageUrl}
          alt={pin.title}
          loading="lazy"
          decoding="async"
          className="w-full bg-[var(--v-beige)] object-cover"
          style={pin.width && pin.height ? { aspectRatio: `${pin.width}/${pin.height}` } : undefined}
        />
      </Link>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100" />
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between gap-2 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <div className="pointer-events-auto">
          {user ? (
            <SaveToCollectionDialog pinId={pin.id} saved={pin.saved} />
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link to="/login">Save</Link>
            </Button>
          )}
        </div>
        <div className="pointer-events-auto">
          <Button
            size="sm"
            variant={pin.liked ? "accent" : "secondary"}
            loading={like.isPending}
            onClick={(e) => {
              e.preventDefault();
              like.mutate();
            }}
          >
            <Icon name="heart" className={pin.liked ? "fill-current" : undefined} />
          </Button>
        </div>
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium">
          {pin.title}
          {pin.isNsfw && (
            <span className="ml-1.5 rounded-[var(--r-pill)] bg-[var(--v-ink)] px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-[var(--v-paper)]">
              NSFW
            </span>
          )}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar size="sm">
              {pin.user.image ? <AvatarImage src={pin.user.image} /> : null}
              <AvatarFallback>{pin.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-[var(--v-text-2)]">@{pin.user.username}</span>
          </span>
        </div>
        {pin.muses.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {pin.muses.slice(0, 2).map((m) => (
              <Link
                key={m.id}
                to="/muse/$slug"
                params={{ slug: m.slug }}
                className="shrink-0"
                onClick={() => track("muse_chip_click", { muse: m.name, pinId: pin.id })}
              >
                <span className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--v-border)] bg-[var(--v-paper)] py-0.5 pl-0.5 pr-2 text-xs font-medium transition-colors hover:bg-[var(--v-beige)]">
                  {m.featuredImage ? (
                    <img src={m.featuredImage} alt="" className="size-5 rounded-full object-cover" />
                  ) : (
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--v-beige)] text-[9px] font-bold">
                      {m.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  {m.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ masonry feed ------------------------------ */

export function FeedSkeleton({ count = 8 }: { count?: number }) {
  const heights = [220, 300, 180, 260, 240, 200, 280, 190];
  return (
    <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="break-inside-avoid">
          <Skeleton className="w-full rounded-[var(--r-card)]" style={{ height: heights[i % heights.length] }} />
          <div className="mt-2 flex items-center gap-2 px-1">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}:{
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Empty>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <EmptyTitle>{title}</EmptyTitle>
      {description && <EmptyDescription>{description}</EmptyDescription>}
      {action && <div className="mt-2">{action}</div>}
    </Empty>
  );
}

export function ErrorState({ description, onRetry }: { description?: string; onRetry?: () => void }) {
  return (
    <Alert variant="danger">
      <AlertIcon />
      <AlertBody>
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>{description ?? "We couldn't load this. It may be a temporary hiccup."}</AlertDescription>
        {onRetry ? (
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : null}
      </AlertBody>
    </Alert>
  );
}

export function MasonryFeed({
  pins,
  emptyText,
  error,
  onRetry,
}: {
  pins: FeedPin[] | undefined;
  emptyText: string;
  error?: unknown;
  onRetry?: () => void;
}) {
  if (error && !pins) {
    return <ErrorState description="We couldn't load this feed. It may be a temporary hiccup." onRetry={onRetry} />;
  }
  if (!pins)
    return (
      <div className="flex flex-col gap-4">
        <FeedSkeleton />
      </div>
    );
  if (!pins.length)
    return (
      <EmptyState
        title="Nothing here yet"
        description={emptyText}
        action={
          <Button asChild variant="accent" size="sm">
            <Link to="/">Refresh</Link>
          </Button>
        }
      />
    );
  return (
    <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
      {pins.map((p, i) => (
        <MotionSurface
          key={p.id}
          preset="rise"
          delay={Math.min(i * 0.04, 0.4)}
          className="break-inside-avoid"
        >
          <FeedCard pin={p} />
        </MotionSurface>
      ))}
    </div>
  );
}


export function NotificationsBell() {
  const qc = useQueryClient();
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: 60_000,
  });
  const unread = (notifications ?? []).filter((n) => n.unread).length;
  const markRead = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const label: Record<string, string> = { like: "liked", save: "saved", comment: "commented on", follow: "started following you" };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex size-9 items-center justify-center rounded-[var(--r-pill)] text-[var(--v-text)] hover:bg-[var(--v-beige)]"
        >
          <Icon name="bell" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-[var(--v-pink)] text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button type="button" className="text-xs text-[var(--v-text-2)] hover:underline" onClick={() => markRead.mutate()}>
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!notifications?.length && (
            <p className="px-3 py-6 text-center text-sm text-[var(--v-text-2)]">No notifications yet.</p>
          )}
          {notifications?.map((n) => (
            <Link
              key={n.id}
              to={n.pinId ? "/pin/$id" : "/u/$username"}
              params={n.pinId ? { id: n.pinId } : { username: n.actorUsername }}
              onClick={() => !n.read && markRead.mutate()}
              className={`flex items-start gap-2 px-3 py-2 text-sm hover:bg-[var(--v-beige)] ${n.unread ? "bg-[var(--v-beige)]/60" : ""}`}
            >
              <Avatar size="sm">
                {n.actorImage ? <AvatarImage src={n.actorImage} /> : null}
                <AvatarFallback>{n.actorName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="font-medium">@{n.actorUsername}</span> {label[n.type] ?? n.type}
                {n.pinTitle ? <span className="block truncate text-xs text-[var(--v-text-2)]">“{n.pinTitle}”</span> : null}
              </span>
              {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--v-pink)]" />}
            </Link>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
