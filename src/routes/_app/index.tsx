import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { getFeed, getTopMuses, me, getSuggestedUsers, toggleFollow, type FeedPin } from "@/lib/queries";
import { MasonryFeed } from "@/components/app-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/")({
  component: Home,
});

type Sort = "foryou" | "latest" | "following";
const PAGE = 40;

function Home() {
  const qc = useQueryClient();
  const [sort, setSort] = useState<Sort>("foryou");
  const [museSlug, setMuseSlug] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const sentinel = useRef<HTMLDivElement>(null);

  const reset = () => {
    setPageCount(1);
    qc.removeQueries({ queryKey: ["feedPages"] });
  };

  const { data: firstPage, isLoading, error: feedError, refetch: refetchFeed } = useQuery({
    queryKey: ["feedPages", sort, museSlug, 0],
    queryFn: () => getFeed({ data: { museSlug: museSlug ?? undefined, sort: museSlug ? undefined : sort, cursor: 0 } }),
  });

  // read any additionally fetched pages from the cache
  const cached = qc.getQueriesData<FeedPin[]>({ queryKey: ["feedPages", sort, museSlug] });
  const pins: FeedPin[] = [];
  const seen = new Set<string>();
  for (const [, data] of cached) {
    for (const p of data ?? []) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        pins.push(p);
      }
    }
  }

  const canLoadMore = (firstPage?.length ?? 0) === PAGE;

  useEffect(() => {
    if (!canLoadMore || !sentinel.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const cursor = pageCount * PAGE;
          setPageCount((c) => c + 1);
          qc.prefetchQuery({
            queryKey: ["feedPages", sort, museSlug, cursor],
            queryFn: () =>
              getFeed({ data: { museSlug: museSlug ?? undefined, sort: museSlug ? undefined : sort, cursor } }),
          });
        }
      },
      { rootMargin: "800px" },
    );
    obs.observe(sentinel.current);
    return () => obs.disconnect();
  }, [canLoadMore, pageCount, qc, sort, museSlug]);

  const { data: muses } = useQuery({ queryKey: ["topMuses"], queryFn: getTopMuses });
  const { data: meUser } = useQuery({ queryKey: ["me"], queryFn: me });

  return (
    <div className="flex flex-col gap-4">
      {/* feed filters as pills tabs */}
      <Tabs
        variant="pills"
        value={museSlug ? `muse:${museSlug}` : `sort:${sort}`}
        onValueChange={(next) => {
          if (next.startsWith("muse:")) {
            setMuseSlug(next.slice(5));
          } else {
            setSort(next.slice(5) as Sort);
            setMuseSlug(null);
          }
          reset();
        }}
      >
        <TabsList className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="sort:foryou">For you</TabsTrigger>
          <TabsTrigger value="sort:latest">Latest</TabsTrigger>
          {meUser && <TabsTrigger value="sort:following">Following</TabsTrigger>}
          {muses?.map((m) => (
            <TabsTrigger
              key={m.id}
              value={`muse:${m.slug}`}
              onClick={() => {
                if (museSlug === m.slug) {
                  setMuseSlug(null);
                  reset();
                }
              }}
            >
              {m.featuredImage ? (
                <img src={m.featuredImage} alt="" className="size-5 rounded-full object-cover" />
              ) : (
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--v-beige)] text-[9px] font-bold">
                  {m.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              {m.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {isLoading ? (
        <MasonryFeed pins={undefined} emptyText="" />
      ) : (
        <>
          <MasonryFeed pins={pins} emptyText="No pins match this filter yet. Be the first to post." error={feedError} onRetry={() => refetchFeed()} />
          {canLoadMore && <div ref={sentinel} className="h-4" />}
          {sort === "following" && !isLoading && pins?.length === 0 && <FollowSuggestions />}
        </>
      )}
    </div>
  );
}

function FollowSuggestions() {
  const qc = useQueryClient();
  const { data: users } = useQuery({ queryKey: ["suggestedUsers"], queryFn: getSuggestedUsers });
  const follow = useMutation({
    mutationFn: (userId: string) => toggleFollow({ data: userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggestedUsers"] });
      qc.invalidateQueries({ queryKey: ["feedPages"] });
    },
  });
  if (!users?.length) return null;
  return (
    <section aria-label="Who to follow" className="rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
      <h2 className="mb-3 text-sm font-semibold">Who to follow</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-[var(--r-card-sm)] border border-[var(--v-border)] p-2.5">
            <img src={u.image ?? ""} alt="" className="size-9 shrink-0 rounded-full bg-[var(--v-beige)] object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.name}</p>
              <p className="truncate text-xs text-[var(--v-text-2)]">@{u.username} · {u.followerCount} followers</p>
            </div>
            <Button size="sm" variant="secondary" loading={follow.isPending && follow.variables === u.id} onClick={() => follow.mutate(u.id)}>
              Follow
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
