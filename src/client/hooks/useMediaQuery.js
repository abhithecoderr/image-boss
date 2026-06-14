/*
 * Tiny matchMedia-based viewport hook. Returns a boolean indicating whether the
 * given media query currently matches. SSR-safe (no-ops when `window` is absent).
 *
 * Usage:
 *   const isMobile = useMediaQuery("(max-width: 991px)");
 */
import { useEffect, useState } from "react";

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mql = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);

    // Sync in case the initial state was wrong (e.g. lazy mount).
    setMatches(mql.matches);

    // matchMedia supports the listener interface across modern browsers.
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }

    // Safari < 14 fallback.
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

export default useMediaQuery;
