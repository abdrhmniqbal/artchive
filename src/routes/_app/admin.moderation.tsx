import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Ban, CheckCircle2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminReports, moderateReport } from "@/lib/queries";

export const Route = createFileRoute("/_app/admin/moderation")({
  component: ModerationPage,
});

type AdminReport = Awaited<ReturnType<typeof getAdminReports>>[number];

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  nsfw: "Adult content",
  copyright: "Copyright",
  other: "Other",
};

function ReportCard({ report }: { report: AdminReport }) {
  const qc = useQueryClient();
  const [ban, setBan] = useState(false);
  const act = useMutation({
    mutationFn: (action: "remove_content" | "dismiss") =>
      moderateReport({ data: { reportId: report.id, action, banUser: action === "remove_content" && ban } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "reports"] }),
  });

  const targetLink =
    report.targetType === "pin"
      ? `/pin/${report.targetId}`
      : report.targetType === "comment" && report.commentPinId
        ? `/pin/${report.commentPinId}`
        : null;

  return (
    <div className="rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-paper)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={report.reason === "harassment" || report.reason === "nsfw" ? "danger" : "default"}>
          {REASON_LABELS[report.reason] ?? report.reason}
        </Badge>
        {report.pinImage && (
          <img src={report.pinImage} alt="" loading="lazy" className="size-8 rounded object-cover" />
        )}
        <span className="text-xs text-[var(--v-text-2)]">
          {report.targetType}
          {report.authorUsername && (<> by @{report.authorUsername}</>)} · reported by @{report.reporterUsername} ·{" "}
          {new Date(report.createdAt).toLocaleDateString()}
        </span>
        {targetLink && (
          <a
            href={targetLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--v-text-2)] underline underline-offset-2 hover:text-[var(--v-text)]"
          >
            view <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      {report.details && <p className="mt-2 text-sm">“{report.details}”</p>}
      {report.targetType === "comment" && report.commentBody && (
        <p className="mt-2 border-l-2 border-[var(--v-border)] pl-3 text-sm text-[var(--v-text-2)]">
          {report.commentBody.length > 160 ? `${report.commentBody.slice(0, 160)}…` : report.commentBody}
        </p>
      )}
      {act.isError && <p className="mt-2 text-xs text-[var(--status-danger-ink,#e0567a)]">{String(act.error)}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="danger" disabled={act.isPending} onClick={() => act.mutate("remove_content")}>
          <CheckCircle2 className="size-3.5" /> Remove content
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--v-text-2)]">
          <input type="checkbox" checked={ban} onChange={(e) => setBan(e.target.checked)} className="accent-[var(--v-pink)]" />
          <Ban className="size-3.5" /> also ban author
        </label>
        <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate("dismiss")}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function ModerationPage() {
  const [status, setStatus] = useState<"open" | "actioned" | "dismissed">("open");
  const { data: reports, isLoading, error } = useQuery({
    queryKey: ["admin", "reports", status],
    queryFn: () => getAdminReports({ data: { status } }),
    retry: 1,
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Moderation</h1>
        <p className="text-sm text-[var(--v-text-2)]">Review reports, remove content and ban abusive users.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="size-4 text-[var(--v-pink)]" />
        {(["open", "actioned", "dismissed"] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? "accent" : "ghost"} onClick={() => setStatus(s)}>
            {s}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--status-danger-ink,#e0567a)]">{String(error)}</p>}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !reports?.length ? (
        <p className="rounded-[var(--r-card)] border border-dashed border-[var(--v-border)] p-6 text-center text-sm text-[var(--v-text-2)]">
          No {status} reports.
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}
