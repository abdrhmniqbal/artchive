import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/app-shell";

export const Route = createFileRoute("/_app/saved")({
  component: SavedPage,
});

function SavedPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Saved</h1>
      <EmptyState
        title="Nothing saved yet"
        description="Boards and pins you save will show up here."
      />
    </div>
  );
}
