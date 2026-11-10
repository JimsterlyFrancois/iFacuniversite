import { useEffect } from "react";

/**
 * Refreshes a workspace when it becomes visible and periodically while it stays open.
 * The callback is expected to be stable (normally a useCallback result).
 */
export default function useAutoRefresh(callback, enabled = true, intervalMs = 20000) {
  useEffect(() => {
    if (!enabled || typeof callback !== "function") return undefined;

    let inFlight = false;
    let disposed = false;

    const refresh = () => {
      if (disposed || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      Promise.resolve()
        .then(callback)
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    };

    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [callback, enabled, intervalMs]);
}
