import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link , useRouter } from "@tanstack/react-router";
import { Flag, Heart, Link2, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { addComment, deletePin, getComments, getPin, me, toggleCommentLike, toggleFollow, toggleLike,
  reportContent, getRelatedPins, getRelatedTags, updatePin, editComment, deleteComment } from "@/lib/queries";
import { SaveToCollectionDialog, EmptyState , MasonryFeed , ErrorState } from "@/components/app-shell";
// module-level so throttle state survives re-renders/remounts (cross-module imports get tree-shaken in this chunk, so defined here)
function leadThrottle<TArgs extends unknown[]>(fn: (...a: TArgs) => void, waitMs: number) {
  let last = 0;
  return (...a: TArgs) => {
    if (Date.now() - last < waitMs) return;
    last = Date.now();
    fn(...a);
  };
}


export const Route = createFileRoute("/_app/pin/$id")({
  loader: async ({ params }) => {
    try {
      return await getPin({ data: params.id });
    } catch {
      return { failed: true as const };
    }
  },
  head: ({ match }) => {
    const d = match.loaderData as { pin?: { title?: string | null; description?: string | null; imageUrl?: string; user?: { name?: string } } } | null | undefined;
    const pin = d?.pin;
    const title = pin?.title ? `${pin.title} · Artchive` : "Artchive";
    const desc = pin?.description || "Discover and save pins on Artchive";
    const img = pin?.imageUrl;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:image", content: img }] : [{ name: "twitter:card", content: "summary" }]),
      ],
    };
  },
  component: PinPage,
});

type CommentRow = Awaited<ReturnType<typeof getComments>>[number];

function CommentItem({
  comment,
  replies,
  depth,
  pinId,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  depth: number;
  pinId: string;
}) {
  const qc = useQueryClient();
  const { data: meUser } = useQuery({ queryKey: ["me"], queryFn: me });
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [showReplies, setShowReplies] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

  const saveEdit = useMutation({
    mutationFn: () => editComment({ data: { id: comment.id, body: editBody.trim() } }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["comments", pinId] });
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteComment({ data: comment.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", pinId] }),
  });

  const like = useMutation({
    mutationFn: () => toggleCommentLike({ data: comment.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", pinId] }),
  });
  const postReply = useMutation({
    mutationFn: () => addComment({ data: { pinId, body: reply.trim(), parentId: comment.id } }),
    onSuccess: () => {
      setReply("");
      setReplying(false);
      setShowReplies(true);
      qc.invalidateQueries({ queryKey: ["comments", pinId] });
    },
  });

  return (
    <div className={depth > 0 ? "ml-6 border-l border-[var(--v-border)] pl-3" : ""}>
      <div className="flex gap-2">
        <Avatar size="sm">
          {comment.userImage ? <AvatarImage src={comment.userImage} /> : null}
          <AvatarFallback>{comment.userName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">
            @{comment.userUsername}{" "}
            <span className="font-normal text-[var(--v-text-2)]">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
          </p>
          {editing ? (
            <div className="mt-1 flex flex-col gap-1">
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} maxLength={1000} />
              <div className="flex gap-2">
                <Button size="sm" variant="accent" disabled={!editBody.trim() || saveEdit.isPending} onClick={() => saveEdit.mutate()}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditBody(comment.body); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm">{comment.body}</p>
          )}
          <div className="mt-1 flex items-center gap-3">
            {meUser && (
              <button
                type="button"
                onClick={() => like.mutate()}
                disabled={like.isPending}
                className={`inline-flex items-center gap-1 text-xs transition-colors ${
                  comment.likedByMe ? "font-medium text-[var(--v-danger-ink,#e0567a)]" : "text-[var(--v-text-2)] hover:text-[var(--v-text)]"
                }`}
              >
                <Heart className={comment.likedByMe ? "size-3.5 fill-current" : "size-3.5"} />
                {comment.likeCount > 0 ? comment.likeCount : "Like"}
              </button>
            )}
            {meUser && meUser.id !== comment.userId && (
              <ReportDialog targetType="comment" targetId={comment.id} label="Report" />
            )}
            {meUser?.id === comment.userId && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-[var(--v-text-2)] hover:text-[var(--v-text)]"
              >
                Edit
              </button>
            )}
            {meUser?.id === comment.userId && (
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="text-xs text-[var(--v-text-2)] hover:text-[var(--v-danger-ink,#e0567a)]"
              >
                Delete
              </button>
            )}
            {meUser && depth < 3 && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="text-xs text-[var(--v-text-2)] hover:text-[var(--v-text)]"
              >
                Reply
              </button>
            )}
          </div>
          {replying && (
            <div className="mt-2 flex gap-2">
              <Input
                value={reply}
                autoFocus
                placeholder={`Reply to @${comment.userUsername}…`}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && reply.trim() && postReply.mutate()}
              />
              <Button size="sm" loading={postReply.isPending} disabled={!reply.trim()} onClick={() => postReply.mutate()}>
                Reply
              </Button>
            </div>
          )}
        </div>
      </div>
      {replies.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {replies.length > 1 && (
            <button
              type="button"
              onClick={() => setShowReplies((v) => !v)}
              className="ml-6 self-start text-xs text-[var(--v-text-2)] underline-offset-2 hover:underline"
            >
              {showReplies ? "Hide" : `Show`} {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </button>
          )}
          {showReplies &&
            replies.map((r) => (
              <CommentItem key={r.id} comment={r} replies={[]} depth={depth + 1} pinId={pinId} />
            ))}
        </div>
      )}
    </div>
  );
}

function PinPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: meUser } = useQuery({ queryKey: ["me"], queryFn: me });
  const { data, isLoading, error: pinError, refetch: refetchPin } = useQuery({ queryKey: ["pin", id], queryFn: () => getPin({ data: id }) });
  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ["comments", id],
    queryFn: () => getComments({ data: id }),
  });
  const [comment, setComment] = useState("");

  const like = useMutation({
    mutationFn: () => toggleLike({ data: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pin", id] }),
  });
  // client-side pacing: one like-toggle per second max (CF binding still guards server-side)
  const follow = useMutation({
    mutationFn: (uid: string) => toggleFollow({ data: uid }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pin", id] }),
  });
  // client-side pacing: max one like/follow toggle per second (CF binding still guards server-side)
  const likeMutate = leadThrottle(() => like.mutate(), 1000);
  const followMutate = leadThrottle((uid: unknown) => follow.mutate(uid as string), 1000);
  const remove = useMutation({
    mutationFn: () => deletePin({ data: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });
  const post = useMutation({
    mutationFn: () => addComment({ data: { pinId: id, body: comment.trim() } }),
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["comments", id] });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="min-h-80 w-full rounded-[var(--r-card)]" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-[var(--r-card)]" />
          <Skeleton className="h-24 w-full rounded-[var(--r-card)]" />
        </div>
      </div>
    );
  }

  if ("failed" in (data ?? {})) {
    return <ErrorState onRetry={() => router.invalidate()} />;
  }
  if (pinError && !data) {
    return <ErrorState onRetry={() => refetchPin()} />;
  }
  if (!data?.pin) {
    return (
      <EmptyState
        title="Pin not found"
        description="This pin doesn't exist or was removed by its owner."
      />
    );
  }
  const { pin, user, muses, likeCount, liked } = data;

  const topLevel = (comments ?? []).filter((c) => !c.parentId);
  const repliesOf = (cid: string) => (comments ?? []).filter((c) => c.parentId === cid);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
      <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)]">
        <img src={pin.imageUrl} alt={pin.title} className="w-full object-contain" />
      </div>
      <aside className="flex flex-col gap-4">
        <div className="rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            {pin.title}
            {pin.isNsfw && (
              <span className="ml-2 rounded-[var(--r-pill)] bg-[var(--v-ink)] px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-[var(--v-paper)]">
                NSFW
              </span>
            )}
          </h1>
          {pin.description && <p className="mt-1 text-sm text-[var(--v-text-2)]">{pin.description}</p>}
          {pin.sourceUrl && (
            <a href={pin.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-xs text-[var(--v-text-2)] underline">
              <Link2 className="size-3.5" /> {new URL(pin.sourceUrl).hostname}
            </a>
          )}
          <RelatedTags pinId={id} />

          {pin.tags && pin.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pin.tags.map((t) => (
                <Link key={t} to="/search" search={{ q: "", tag: t }}>
                  <Badge variant="blue">#{t}</Badge>
                </Link>
              ))}
            </div>
          )}
          {muses.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {muses.map((m) => (
                <Link key={m.id} to="/muse/$slug" params={{ slug: m.slug }}>
                  <span className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--v-border)] bg-[var(--v-paper)] py-0.5 pl-0.5 pr-2 text-xs font-medium transition-colors hover:bg-[var(--v-beige)]">
                    {(m.avatarUrl || m.featuredImage) ? (
                      <img src={m.avatarUrl || m.featuredImage!} alt="" className="size-5 rounded-full object-cover" />
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
          <Separator className="my-4" />
          {user && (
            <div className="flex items-center justify-between gap-2">
              <Link to="/u/$username" params={{ username: user.username }} className="flex items-center gap-2">
                <Avatar size="sm">
                  {user.image ? <AvatarImage src={user.image} /> : null}
                  <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{user.name}</span>
              </Link>
              {meUser && meUser.id !== user.id && (
                <Button size="sm" variant="outline" loading={follow.isPending} onClick={() => followMutate(user.id)}>
                  Follow
                </Button>
              )}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant={liked ? "accent" : "outline"} loading={like.isPending} onClick={() => likeMutate()}>
              <Heart className={liked ? "size-4 fill-current" : "size-4"} /> {likeCount}
            </Button>
            {meUser && <SaveToCollectionDialog pinId={id} />}
            {meUser && meUser.id !== pin.userId && (
              <ReportDialog targetType="pin" targetId={id} />
            )}
            {meUser?.id === pin.userId && <EditPinDialog pin={{ id, title: pin.title, description: pin.description ?? "", sourceUrl: pin.sourceUrl ?? "", tags: pin.tags ?? [] }} />}
            {meUser?.id === pin.userId && (
              <Button size="sm" variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
          <h2 className="text-sm font-semibold">Comments</h2>
          {meUser && (
            <div className="mt-2 flex gap-2">
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment…"
                onKeyDown={(e) => e.key === "Enter" && comment.trim() && post.mutate()}
              />
              <Button size="sm" loading={post.isPending} disabled={!comment.trim()} onClick={() => post.mutate()}>
                Post
              </Button>
            </div>
          )}
          <div className="mt-3 flex flex-col gap-4">
            {commentsLoading && (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <Skeleton className="size-7 rounded-full" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {topLevel.map((c) => (
              <CommentItem key={c.id} comment={c} replies={repliesOf(c.id)} depth={0} pinId={id} />
            ))}
            {comments && !comments.length && (
              <p className="text-sm text-[var(--v-text-2)]">No comments yet. Start the conversation.</p>
            )}
          </div>
        </div>
      </aside>
      <RelatedPins pinId={id} />
    </div>
  );
}

function RelatedPins({ pinId }: { pinId: string }) {
  const { data } = useQuery({ queryKey: ["related", pinId], queryFn: () => getRelatedPins({ data: pinId }) });
  if (!data?.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">More like this</h2>
      <MasonryFeed pins={data} emptyText="" />
    </section>
  );
}


/* --------------------------- inline report dialog -------------------------- */
/* defined locally: cross-module component imports get tree-shaken in this chunk */

const REPORT_REASONS = [
  { value: "spam", label: "Spam or misleading" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "nsfw", label: "Adult content" },
  { value: "copyright", label: "Copyright violation" },
  { value: "other", label: "Something else" },
] as const;

function ReportDialog({
  targetType,
  targetId,
  label = "Report",
}: {
  targetType: "pin" | "comment" | "user";
  targetId: string;
  label?: string;
}) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const qc = useQueryClient();

  const report = useMutation({
    mutationFn: () =>
      reportContent({
        data: { targetType, targetId, reason: reason as (typeof REPORT_REASONS)[number]["value"], details: details || undefined },
      }),
    onSuccess: () => {
      setDone(true);
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
    },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Flag className="size-3.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {targetType}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {done ? (
            <p className="text-sm text-[var(--v-text-2)]">
              Thanks! Your report has been submitted and our moderators will take a look.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5" role="radiogroup" aria-label="Reason">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={reason === r.value}
                    onClick={() => setReason(r.value)}
                    className={`w-full rounded-[var(--r-card)] border px-3 py-2 text-left text-sm transition-colors ${
                      reason === r.value
                        ? "border-[var(--v-pink)] bg-[var(--v-beige)]"
                        : "border-[var(--v-border)] hover:bg-[var(--v-beige)]"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <Textarea
                placeholder="Add details (optional)"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              {done ? "Close" : "Cancel"}
            </Button>
          </DialogClose>
          {!done && (
            <Button variant="accent" size="sm" disabled={!reason || report.isPending} onClick={() => report.mutate()}>
              {report.isPending ? <Loader2 className="size-4 animate-spin" /> : "Submit report"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function EditPinDialog({ pin }: { pin: { id: string; title: string; description: string; sourceUrl: string; tags: string[] } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(pin.title);
  const [description, setDescription] = useState(pin.description);
  const [sourceUrl, setSourceUrl] = useState(pin.sourceUrl);
  const [tags, setTags] = useState(pin.tags.join(", "));
  const save = useMutation({
    mutationFn: () =>
      updatePin({
        data: {
          id: pin.id,
          title: title.trim(),
          description: description.trim() || undefined,
          sourceUrl: sourceUrl.trim() || "",
          tags: tags.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pin", pin.id] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["feedPages"] });
      qc.invalidateQueries({ queryKey: ["related", pin.id] });
      setOpen(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="size-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit pin</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={100} />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} maxLength={500} />
          <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Source URL (optional)" />
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </DialogClose>
          <Button variant="accent" size="sm" disabled={!title.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RelatedTags({ pinId }: { pinId: string }) {
  const { data: tags } = useQuery({
    queryKey: ["relatedTags", pinId],
    queryFn: () => getRelatedTags({ data: pinId }),
  });
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-[var(--v-text-2)]">Related:</span>
      {tags.map((t) => (
        <Link
          key={t}
          to="/search"
          search={{ q: "", tag: t }}
          className="rounded-full border border-[var(--v-border)] px-2.5 py-1 text-xs text-[var(--v-text-2)] transition-colors hover:bg-[var(--v-beige)]"
        >
          #{t}
        </Link>
      ))}
    </div>
  );
}
