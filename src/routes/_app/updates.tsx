import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/app-shell";

export const Route = createFileRoute("/_app/updates")({
  component: UpdatesPage,
});

function UpdatesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Updates</h1>
      <EmptyState
        title="No updates yet"
        description="Likes, saves, comments and follows will land here."
      />
    </div>
  );
}
