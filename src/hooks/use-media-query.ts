import { useEffect, useState } from "react";

/**
 * Reactive matchMedia. SSR-safe: renders `defaultValue` on the server and
 * corrects on mount. The effect inside is intentional; matchMedia has no
 * synchronous reactive primitive.
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True on phone widths (below the md breakpoint). */
export function useIsPhone(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
