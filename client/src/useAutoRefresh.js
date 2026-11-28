import { useEffect } from "react";

function prefersLowDataConnection() {
  const connection = typeof navigator !== "undefined"
    ? navigator.connection || navigator.mozConnection || navigator.webkitConnection
    : null;
  return Boolean(connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType));
}

/**
 * Cache-first background synchronization.
 * - Polls every five minutes instead of every minute.
 * - Skips periodic polling on 2G / slow-2G and data-saver connections.
 * - Still refreshes once when the app returns to the foreground or connectivity returns.
 * - Never reloads the page or interrupts active form editing.
 */
export default function useAutoRefresh(callback, enabled = true, intervalMs = 300000) {
  useEffect(() => {
    if (!enabled || typeof callback !== "function") return undefined;
    let inFlight = false;
    let disposed = false;
    let lastActivity = Date.now();

    const markActivity = () => { lastActivity = Date.now(); };
    const isEditing = () => {
      const active = document.activeElement;
      if (!active) return false;
      if (active.isContentEditable) return true;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return true;
      return Boolean(active.closest("form"));
    };
    const refresh = async (force = false) => {
      if (disposed || inFlight || document.visibilityState === "hidden" || isEditing()) return;
      if (!force && (Date.now() - lastActivity < 5000 || prefersLowDataConnection())) return;
      inFlight = true;
      try { await callback({ silent: true }); }
      catch { /* Background errors must not interrupt the current task. */ }
      finally { inFlight = false; }
    };
    const onFocus = () => { markActivity(); window.setTimeout(() => refresh(true), 1200); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        markActivity();
        window.setTimeout(() => refresh(true), 1200);
      }
    };
    const onOnline = () => {
      markActivity();
      window.setTimeout(() => refresh(true), 1200);
    };
    const events = ["pointerdown", "keydown", "input", "change", "touchstart"];
    events.forEach(event => document.addEventListener(event, markActivity, true));
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => refresh(false), intervalMs);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      events.forEach(event => document.removeEventListener(event, markActivity, true));
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [callback, enabled, intervalMs]);
}
