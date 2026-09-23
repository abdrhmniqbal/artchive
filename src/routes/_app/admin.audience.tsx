import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart } from "@/components/ui/bar-chart";
import { PieChart } from "@/components/ui/pie-chart";
import { getAdminTopMuses, getAdminTopTags } from "@/lib/queries";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/admin/audience")({
  component: AudiencePage,
});

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "All time", days: undefined },
] as const;

function AudiencePage() {
  const [days, setDays] = useState<number | undefined>(7);
  const { data: topMuses } = useQuery({
    queryKey: ["admin", "topMuses", days],
    queryFn: () => getAdminTopMuses({ data: { days } }),
  });
  const { data: topTags } = useQuery({
    queryKey: ["admin", "topTags", days],
    queryFn: () => getAdminTopTags({ data: { days } }),
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Audience</h1>
        <p className="text-sm text-[var(--v-text-2)]">Which muses and tags the community is gravitating toward.</p>
      </div>

      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <Button key={r.label} size="sm" variant={days === r.days ? "accent" : "ghost"} onClick={() => setDays(r.days)}>
            {r.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Trending muses (by user affinity)</h2>
          {(topMuses && topMuses.length) ? (
            <BarChart
              variant="horizontal"
              caption="Trending muses"
              data={topMuses.map((m) => ({ label: m.name, affinity: Number(m.affinity.toFixed(1)) }))}
              series={[{ key: "affinity", label: "Affinity" }]}
              className="h-56 w-full"
            />
          ) : (
            <p className="text-sm text-[var(--v-text-2)]">No muse activity yet.</p>
          )}
        </div>

        <div className="rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Trending tags (by user affinity)</h2>
          {(topTags && topTags.length) ? (
            <PieChart
              caption="Trending tags"
              data={topTags.map((t) => ({ label: "#" + t.tag, value: Number(t.affinity.toFixed(0)) }))}
              className="h-56 w-full"
            />
          ) : (
            <p className="text-sm text-[var(--v-text-2)]">No tag activity yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
