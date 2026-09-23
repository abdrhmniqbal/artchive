import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, Heart, MessageSquare, Sparkles, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart } from "@/components/ui/bar-chart";
import { getAdminOverview, getAdminTimeseries, getAdminTopPages, getAdminRecentEvents } from "@/lib/queries";

export const Route = createFileRoute("/_app/admin/")({
  component: OverviewPage,
});

type Timeseries = Awaited<ReturnType<typeof getAdminTimeseries>>;

function StatCard({ icon: IconCmp, label, value }: { icon: typeof Eye; label: string; value: number | undefined }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--v-beige)]">
        <IconCmp className="size-5 text-[var(--v-text-2)]" />
      </span>
      <div>
        <p className="text-xs text-[var(--v-text-2)]">{label}</p>
        <p className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {value === undefined ? "-" : value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function TimeseriesChart({ data }: { data: Timeseries | undefined }) {
  if (!data) return <Skeleton className="h-56 w-full rounded-[var(--r-card)]" />;
  if (!data.length) return <p className="py-8 text-center text-sm text-[var(--v-text-2)]">No traffic recorded yet.</p>;
  return (
    <BarChart
      caption="Traffic, last 14 days"
      data={data.map((d) => ({ label: d.day.slice(5), views: d.views, events: d.events }))}
      series={[
        { key: "views", label: "Views" },
        { key: "events", label: "Events" },
      ]}
      className="h-56 w-full"
    />
  );
}

function OverviewPage() {
  const { data: overview } = useQuery({ queryKey: ["admin", "overview"], queryFn: getAdminOverview });
  const { data: timeseries } = useQuery({ queryKey: ["admin", "timeseries"], queryFn: getAdminTimeseries });
  const { data: topPages } = useQuery({ queryKey: ["admin", "topPages"], queryFn: getAdminTopPages });
  const { data: recentEvents } = useQuery({ queryKey: ["admin", "recentEvents"], queryFn: getAdminRecentEvents });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-[var(--v-text-2)]">Traffic and platform health at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Eye} label="Pageviews" value={overview?.views} />
        <StatCard icon={Sparkles} label="Events" value={overview?.events} />
        <StatCard icon={Users} label="Users" value={overview?.users} />
        <StatCard icon={Sparkles} label="Pins" value={overview?.pins} />
        <StatCard icon={Heart} label="Likes" value={overview?.likes} />
        <StatCard icon={MessageSquare} label="Comments" value={overview?.comments} />
      </div>

      <div className="rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Traffic · last 30 days</h2>
          <span className="flex items-center gap-3 text-xs text-[var(--v-text-2)]">
            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-[var(--v-pink)]" /> views</span>
            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-[var(--v-blue)]" /> events</span>
          </span>
        </div>
        <TimeseriesChart data={timeseries} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Top pages</h2>
          <div className="flex flex-col gap-1.5">
            {(topPages ?? []).map((p) => (
              <div key={p.path} className="flex items-center justify-between text-sm">
                <span className="truncate font-mono text-xs">{p.path}</span>
                <span className="shrink-0 text-[var(--v-text-2)]">{p.views.toLocaleString()}</span>
              </div>
            ))}
            {topPages && !topPages.length && <p className="text-sm text-[var(--v-text-2)]">No pageviews yet.</p>}
          </div>
        </div>

        <div className="rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent events</h2>
          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {(recentEvents ?? []).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  <span className="font-mono text-xs">{e.type}</span>{" "}
                  <span className="font-mono text-xs text-[var(--v-text-2)]">{e.name ?? e.path ?? ""}</span>
                </span>
                <span className="shrink-0 text-xs text-[var(--v-text-2)]">
                  {new Date(e.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {recentEvents && !recentEvents.length && <p className="text-sm text-[var(--v-text-2)]">No events yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
