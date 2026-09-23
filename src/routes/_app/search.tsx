import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { getFeed, searchMuses, type FeedPin } from "@/lib/queries";
import { MasonryFeed } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    tag: typeof search.tag === "string" ? search.tag : "",
  }),
  component: SearchPage,
});

const PAGE = 40;

function SearchPage() {
  const { q: initialQ, tag } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(initialQ);
  const [query, setQuery] = useState(initialQ);
  const [pageCount, setPageCount] = useState(1);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(initialQ);
    setQuery(initialQ);
    setPageCount(1);
  }, [initialQ, tag]);

  const first = useQuery({
    queryKey: ["searchFeed", query, tag, 0],
    queryFn: () =>
      getFeed({ data: { q: query || undefined, tag: tag || undefined, sort: "latest", cursor: 0 } }),
  });
  const searchError = first.error;
  const refetchSearch = first.refetch;

  // subsequent pages are fetched imperatively when the sentinel becomes visible;
  // read whatever pages already live in the cache
  const cachedPages = qc.getQueriesData<FeedPin[]>({
    queryKey: ["searchFeed", query, tag],
  });
  const pins: FeedPin[] = [];
  const seen = new Set<string>();
  for (const [, data] of cachedPages) {
    for (const p of data ?? []) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        pins.push(p);
      }
    }
  }

  const canLoadMore = (first.data ?? []).length === PAGE;

  useEffect(() => {
    if (!canLoadMore || !sentinel.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const cursor = pageCount * PAGE;
          setPageCount((c) => c + 1);
          qc.prefetchQuery({
            queryKey: ["searchFeed", query, tag, cursor],
            queryFn: () =>
              getFeed({ data: { q: query || undefined, tag: tag || undefined, sort: "latest", cursor } }),
          });
        }
      },
      { rootMargin: "600px" },
    );
    obs.observe(sentinel.current);
    return () => obs.disconnect();
  }, [canLoadMore, pageCount, qc, query, tag]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/search", search: { q: draft, tag: "" } });
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--v-text-2)]" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search pins, tags, muses…"
          className="pl-10 pr-9"
          aria-label="Search"
        />
        {draft && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setDraft("");
              navigate({ to: "/search", search: { q: "", tag: "" } });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--v-text-2)] hover:text-[var(--v-text)]"
          >
            <X className="size-4" />
          </button>
        )}
      </form>

      {tag && (
        <Tabs variant="pills" value={`tag:${tag}`}>
          <TabsList>
            <TabsTrigger
              value={`tag:${tag}`}
              onClick={() => navigate({ to: "/search", search: { q: query, tag: "" } })}
            >
              #{tag} <X className="size-3.5" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {query && <MuseResults q={query} />}

      {!query && !tag ? (
        <p className="py-16 text-center text-sm text-[var(--v-text-2)]">
          Search for pins by title, description, tag or muse.
        </p>
      ) : first.isLoading ? (
        <p className="py-16 text-center text-sm text-[var(--v-text-2)]">Searching…</p>
      ) : (
        <>
          <MasonryFeed pins={pins} emptyText={`No pins match “${query || tag}” yet.`} error={searchError} onRetry={() => refetchSearch()} />
          {canLoadMore && <div ref={sentinel} className="h-4" />}
        </>
      )}
    </div>
  );
}

function MuseResults({ q }: { q: string }) {
  const { data: muses } = useQuery({
    queryKey: ["museSearch", q],
    queryFn: () => searchMuses({ data: q }),
  });
  if (!muses?.length) return null;
  return (
    <section aria-label="Muse results">
      <h2 className="mb-2 text-sm font-semibold text-[var(--v-text-2)]">Muses</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {muses.map((m) => (
          <Link
            key={m.id}
            to="/muse/$slug"
            params={{ slug: m.slug }}
            className="flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-3 text-center transition-shadow hover:shadow-md"
          >
            <Avatar size="lg">
              <AvatarFallback>{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="w-full truncate text-xs font-medium">{m.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
