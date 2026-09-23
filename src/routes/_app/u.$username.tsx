import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flag, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { createCollection, getFeed, getUserCollections, getUserLikes, getUserProfile, me, toggleFollow,
  reportContent, updateMe,
} from "@/lib/queries";
import { MasonryFeed } from "@/components/app-shell";

function parseCovers(covers: unknown): string[] {
  if (Array.isArray(covers)) return covers as string[];
  if (typeof covers === "string") {
    try {
      const parsed = JSON.parse(covers);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

type ProfileTab = "pins" | "collections" | "likes";

export const Route = createFileRoute("/_app/u/$username")({
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const qc = useQueryClient();
  const { data, error: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => getUserProfile({ data: username }),
  });
  const { data: pins } = useQuery({
    queryKey: ["feed", { userId: data?.user.id }],
    queryFn: () => getFeed({ data: { userId: data!.user.id } }),
    enabled: !!data,
  });
  const { data: collections } = useQuery({
    queryKey: ["userCollections", username],
    queryFn: () => getUserCollections({ data: username }),
  });
  const { data: meUser } = useQuery({ queryKey: ["me"], queryFn: me });
  const ownProfile = !!meUser && !!data && meUser.id === data.user.id;
  const { data: likes, error: likesError, refetch: refetchLikes } = useQuery({
    queryKey: ["userLikes", username],
    queryFn: () => getUserLikes({ data: username }),
    enabled: ownProfile,
  });
  const [open, setOpen] = useState(false);
  const [tab, setTabState] = useState<ProfileTab>("pins");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q === "collections" || (q === "likes" && ownProfile)) setTabState(q);
    else if (q === "pins") setTabState("pins");
  }, [ownProfile]);
  const setTab = (v: string) => {
    const next = (v === "pins" || v === "collections" || (v === "likes" && ownProfile) ? v : "pins") as ProfileTab;
    setTabState(next);
    const url = new URL(window.location.href);
    if (next === "pins") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };
  const [name, setName] = useState("");
  const newCol = useMutation({
    mutationFn: (v: { name: string }) => createCollection({ data: v }),
    onSuccess: () => {
      setOpen(false);
      setName("");
      qc.invalidateQueries({ queryKey: ["userCollections", username] });
      setTab("collections");
    },
  });
  const follow = useMutation({ mutationFn: (uid: string) => toggleFollow({ data: uid }) });

  if (!data) {
    if (profileError) {
      return (
        <div className="flex flex-col items-center gap-3 p-16 text-center">
          <p className="text-sm font-medium">Something went wrong loading this profile.</p>
          <Button variant="outline" size="sm" onClick={() => refetchProfile()}>
            Try again
          </Button>
        </div>
      );
    }
    return <p className="p-8 text-center text-[var(--v-text-2)]">User not found.</p>;
  }
  const { user, pinCount, followers, following, isFollowing, isMe } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-[var(--r-panel)] border border-[var(--v-border)] bg-[var(--v-paper)] p-8 text-center">
        <Avatar size="lg">
          {user.image ? <AvatarImage src={user.image} /> : null}
          <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{user.name}</h1>
          <p className="text-sm text-[var(--v-text-2)]">@{user.username}</p>
          {user.bio && <p className="mx-auto mt-2 max-w-md text-sm">{user.bio}</p>}
        </div>
        {isMe && <EditProfileDialog user={{ name: user.name, bio: user.bio ?? "" }} />}
        <div className="flex gap-4 text-sm text-[var(--v-text-2)]">
          <span>
            <strong className="text-[var(--v-text)]">{pinCount}</strong> pins
          </span>
          <span>
            <strong className="text-[var(--v-text)]">{followers}</strong> followers
          </span>
          <span>
            <strong className="text-[var(--v-text)]">{following}</strong> following
          </span>
        </div>
        {isMe ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="accent">
                + New collection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New collection</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <Field>
                  <FieldLabel>Name</FieldLabel>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sana 2026" />
                </Field>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button size="sm" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                <Button size="sm" variant="accent" disabled={!name.trim()} loading={newCol.isPending} onClick={() => newCol.mutate({ name: name.trim() })}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          meUser && (
            <>
              <Button size="sm" variant={isFollowing ? "outline" : "accent"} onClick={() => follow.mutate(user.id)}>
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <ReportDialog targetType="user" targetId={user.id} />
            </>
          )
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pins">Pins</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          {ownProfile && <TabsTrigger value="likes">Likes</TabsTrigger>}
        </TabsList>
        <TabsContent value="pins">
          <MasonryFeed pins={pins} emptyText="No pins yet." />
        </TabsContent>
        <TabsContent value="collections">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections?.map((c) => (
              <Link key={c.id} to="/c/$id" params={{ id: c.id }} className="group block">
                <div className="flex h-32 gap-0.5 overflow-hidden rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-beige)]">
                  {parseCovers(c.covers).slice(0, 3).map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      loading="lazy"
                      className={`min-w-0 flex-1 object-cover transition-transform group-hover:scale-[1.03] ${i === 0 ? "flex-[2]" : ""}`}
                    />
                  ))}
                  {!parseCovers(c.covers).length && (
                    <div className="flex w-full items-center justify-center text-xs text-[var(--v-text-2)]">Empty board</div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{c.name}</span>
                  <Badge variant="pink">{c.pinCount} pins</Badge>
                </div>
                {c.description && <p className="mt-1 line-clamp-1 text-sm text-[var(--v-text-2)]">{c.description}</p>}
              </Link>
            ))}
            {collections && !collections.length && (
              <p className="text-sm text-[var(--v-text-2)]">No collections yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="likes">
          {likes?.private ? (
            <p className="rounded-[var(--r-card)] border border-dashed border-[var(--v-border)] p-6 text-center text-sm text-[var(--v-text-2)]">
              Your likes are only visible to you.
            </p>
          ) : (
            <MasonryFeed pins={likes?.pins} emptyText="Pins you like will show up here." error={likesError} onRetry={() => refetchLikes()} />
          )}
        </TabsContent>
      </Tabs>
    </div>
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

function EditProfileDialog({ user }: { user: { name: string; bio: string } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const save = useMutation({
    mutationFn: () => updateMe({ data: { name: name.trim(), bio: bio.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userProfile"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      setOpen(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="size-4" /> Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" maxLength={60} />
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio (optional)" rows={3} maxLength={200} />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </DialogClose>
          <Button variant="accent" size="sm" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
