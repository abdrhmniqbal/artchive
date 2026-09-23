import { useSyncExternalStore } from "react";

/**
 * Tiny store letting the main Navbar render the admin drawer trigger,
 * so mobile admin nav lives in the existing navbar instead of a second bar.
 * The admin layout registers its "open drawer" action on mount.
 */
type AdminNavState = { openDrawer: (() => void) | null };

let state: AdminNavState = { openDrawer: null };
const listeners = new Set<() => void>();

export function setAdminNavTrigger(fn: (() => void) | null) {
  state = { openDrawer: fn };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAdminNavTrigger(): (() => void) | null {
  return useSyncExternalStore(subscribe, () => state.openDrawer, () => null);
}
