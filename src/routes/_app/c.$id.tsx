import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pencil, Trash2, X, Loader2, UserPlus, Pin, PinOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody, DialogClose } from "@/components/ui/dialog";
import { getCollection, getCollectionMeta, updateCollection, deleteCollection, removeFromCollection, getCollaborators, inviteCollaborator, removeCollaborator, togglePinned } from "@/lib/queries";
import { MasonryFeed , ErrorState } from "@/components/app-shell";

export const Route = createFileRoute("/_app/c/$id")({
  component: CollectionPage,
});

function CollectionPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, error: collectionError, refetch: refetchCollection } = useQuery({ queryKey: ["collection", id], queryFn: () => getCollection({ data: id }) });
  const { data: meta } = useQuery({ queryKey: ["collectionMeta", id], queryFn: () => getCollectionMeta({ data: id }) });

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const openEdit = () => {
    if (!meta) return;
    setName(meta.name);
    setDescription(meta.description ?? "");
    setIsPublic(meta.isPublic);
    setEditOpen(true);
  };

  const save = useMutation({
    mutationFn: () => updateCollection({ data: { id, name: name.trim(), description: description.trim() || undefined, isPublic } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", id] });
      qc.invalidateQueries({ queryKey: ["collectionMeta", id] });
      qc.invalidateQueries({ queryKey: ["userCollections"] });
      setEditOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteCollection({ data: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userCollections"] });
      navigate({ to: "/" });
    },
  });

  const removePin = useMutation({
    mutationFn: (pinId: string) => removeFromCollection({ data: { collectionId: id, pinId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", id] });
    },
  });

  const pinTop = useMutation({
    mutationFn: (v: { pinId: string; pinned: boolean }) => togglePinned({ data: { collectionId: id, pinId: v.pinId, pinned: v.pinned } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", id] });
    },
  });

  const { data: collaborators } = useQuery({ queryKey: ["collaborators", id], queryFn: () => getCollaborators({ data: id }), enabled: !!meta?.isOwner });

  if (collectionError && !data) {
    return <ErrorState onRetry={() => refetchCollection()} />;
  }
  if (!data?.collection) return <p className="p-8 text-center text-[var(--v-text-2)]">Collection not found.</p>;
  const isOwner = !!meta?.isOwner;
  const pins = (data.pins as Array<{ id: string; imageUrl: string; title: string; isPinned?: boolean }>) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[var(--r-panel)] border border-[var(--v-border)] bg-[var(--v-paper)] p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{data.collection.name}</h1>
            {data.collection.description && <p className="mt-1 text-sm text-[var(--v-text-2)]">{data.collection.description}</p>}
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="pink">{data.pins.length} pins</Badge>
              {meta && !meta.isPublic && <Badge variant="dashed">Private</Badge>}
            </div>
          </div>
          {isOwner && (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={openEdit}>
                <Pencil className="size-4" /> Edit board
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={remove.isPending}
                onClick={() => {
                  if (confirm(`Delete board "${data.collection.name}"?`)) remove.mutate();
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <MasonryFeed pins={data.pins as never} emptyText="Nothing saved here yet." />

              {isOwner && <CollaboratorManager collectionId={id} collaborators={collaborators ?? []} />}

        {isOwner && pins.length > 0 && (
        <div className="rounded-[var(--r-panel)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
          <h2 className="text-sm font-semibold">Manage pins</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pins.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-[var(--r-card-sm)] border border-[var(--v-border)] p-2">
                <img src={p.imageUrl} alt="" className="size-10 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm">{p.title || "Untitled"}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={pinTop.isPending && pinTop.variables?.pinId === p.id}
                  onClick={() => pinTop.mutate({ pinId: p.id, pinned: !p.isPinned })}
                  aria-label={p.isPinned ? "Unpin from board top" : "Pin to board top"}
                >
                  {p.isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                </Button>
                <Button size="sm" variant="ghost" loading={removePin.isPending && removePin.variables === p.id} onClick={() => removePin.mutate(p.id)} aria-label="Remove from board">
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit board</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Board name" maxLength={60} />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} maxLength={200} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Public board (visible on your profile)
            </label>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button variant="accent" size="sm" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CollaboratorManager({ collectionId, collaborators }: { collectionId: string; collaborators: { username: string; name: string; image: string | null; role: string }[] }) {
  const qc = useQueryClient();
  const [invite, setInvite] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const doInvite = useMutation({
    mutationFn: () => inviteCollaborator({ data: { collectionId, username: invite.trim() } }),
    onSuccess: (r: { name?: string }) => {
      setInvite("");
      setMsg(`Invited ${r.name ?? "collaborator"}`);
      qc.invalidateQueries({ queryKey: ["collaborators", collectionId] });
    },
    onError: (e: Error) => setMsg(e.message),
  });
  const doRemove = useMutation({
    mutationFn: (username: string) => removeCollaborator({ data: { collectionId, username } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collaborators", collectionId] }),
  });
  return (
    <section aria-label="Collaborators" className="flex flex-col gap-2 rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <UserPlus className="size-4 text-[var(--v-text-2)]" /> Collaborators
      </h3>
      <div className="flex gap-2">
        <Input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Invite by username" />
        <Button size="sm" disabled={!invite.trim() || doInvite.isPending} onClick={() => doInvite.mutate()}>
          {doInvite.isPending ? <Loader2 className="size-4 animate-spin" /> : "Invite"}
        </Button>
      </div>
      {msg && <p className="text-xs text-[var(--v-text-2)]">{msg}</p>}
      {collaborators.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {collaborators.map((c) => (
            <li key={c.username} className="flex items-center justify-between text-sm">
              <span>@{c.username} <span className="text-xs text-[var(--v-text-2)]">({c.role})</span></span>
              <button type="button" aria-label={`Remove ${c.username}`} className="text-[var(--v-text-2)] hover:text-red-500" onClick={() => doRemove.mutate(c.username)}>
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
