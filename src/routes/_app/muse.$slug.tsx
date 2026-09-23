import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getFeed, getMuse } from "@/lib/queries";
import { MasonryFeed, EmptyState, ErrorState } from "@/components/app-shell";

export const Route = createFileRoute("/_app/muse/$slug")({
  component: MusePage,
});

function MusePage() {
  const { slug } = Route.useParams();
  const { data, isLoading, error: museError, refetch: refetchMuse } = useQuery({ queryKey: ["muse", slug], queryFn: () => getMuse({ data: slug }) });
  const { data: pins, error: feedError, refetch: refetchFeed } = useQuery({ queryKey: ["feed", "latest", slug], queryFn: () => getFeed({ data: { museSlug: slug } }) });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4 rounded-[var(--r-panel)] border border-[var(--v-border)] bg-[var(--v-paper)] p-6">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <MasonryFeed pins={undefined} emptyText="" />
      </div>
    );
  }

  if (museError && !data) {
    return <ErrorState onRetry={() => refetchMuse()} />;
  }
  if (!data?.muse) {
    return (
      <EmptyState
        icon="🎨"
        title="Muse not found"
        description="This muse doesn't exist yet. Tag them in a pin to create their page."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-[var(--r-panel)] border border-[var(--v-border)] bg-[var(--v-paper)] p-6">
        <Avatar size="lg">
          {(data.muse.avatarUrl || data.featuredImage) && (
            <AvatarImage src={data.muse.avatarUrl || data.featuredImage!} />
          )}
          <AvatarFallback>{data.muse.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{data.muse.name}</h1>
          <p className="text-sm text-[var(--v-text-2)]">@{data.muse.slug}</p>
          <Badge variant="pink" className="mt-2">
            {data.pinCount} pins
          </Badge>
        </div>
      </div>

      {data.topPins && data.topPins.length > 1 && (
        <section aria-label="Most loved">
          <h2 className="mb-2 text-sm font-semibold text-[var(--v-text-2)]">Most loved</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {data.topPins.map((tp) => (
              <Link key={tp.id} to="/pin/$id" params={{ id: tp.id }} className="group w-36 shrink-0">
                <img
                  src={tp.imageUrl}
                  alt={tp.title}
                  loading="lazy"
                  className="aspect-[4/5] w-full rounded-[var(--r-card)] border border-[var(--v-border)] object-cover transition-shadow group-hover:shadow-md"
                />
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-[var(--v-text-2)]">
                  <Heart className="size-3" /> {Number(tp.likeCount)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.boards && data.boards.length > 0 && (
        <section aria-label="Boards featuring this muse">
          <h2 className="mb-2 text-sm font-semibold text-[var(--v-text-2)]">Boards featuring this muse</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {data.boards.map((b) => (
              <Link key={b.id} to="/c/$id" params={{ id: b.id }} className="group w-40 shrink-0">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-beige)]">
                  {b.cover ? (
                    <img src={b.cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--v-text-2)]">Board</div>
                  )}
                </div>
                <p className="mt-1 truncate text-sm font-medium">{b.name}</p>
                <p className="truncate text-xs text-[var(--v-text-2)]">@{b.ownerUsername} · {b.pinCount} pins</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <MasonryFeed pins={pins} emptyText="No media tagged with this muse yet." error={feedError} onRetry={() => refetchFeed()} />
    </div>
  );
}
