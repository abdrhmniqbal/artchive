import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, MessageSquare } from "lucide-react";
import { getAdminTopPins } from "@/lib/queries";
import { BarChart } from "@/components/ui/bar-chart";

export const Route = createFileRoute("/_app/admin/content")({
  component: ContentPage,
});

function ContentPage() {
  const { data: topPins } = useQuery({ queryKey: ["admin", "topPins"], queryFn: getAdminTopPins });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Content</h1>
        <p className="text-sm text-[var(--v-text-2)]">What resonates: most engaged pins across Artchive.</p>
      </div>

      <div className="rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Most engaged pins</h2>
        {(topPins && topPins.length) ? (
          <>
            <BarChart
              variant="horizontal"
              caption="Engagement by pin"
              data={topPins.map((p) => ({ label: p.title.slice(0, 18), likes: p.likeCount, comments: p.commentCount }))}
              series={[
                { key: "likes", label: "Likes" },
                { key: "comments", label: "Comments" },
              ]}
              className="h-64 w-full"
            />
            <div className="flex flex-col gap-2">
              {(topPins).map((p) => (
                <Link key={p.id} to="/pin/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-[var(--r-card-sm)] p-1.5 hover:bg-[var(--v-beige)]">
                  <img src={p.imageUrl} alt="" className="size-10 rounded-[var(--r-card-sm)] object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--v-text-2)]">
                    <Heart className="size-3.5" /> {p.likeCount}
                    <MessageSquare className="size-3.5" /> {p.commentCount}
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--v-text-2)]">No pins yet.</p>
        )}
      </div>
    </div>
  );
}
