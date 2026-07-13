"use client";

import { useEffect, useRef } from "react";

interface PollingOptions {
  /** Poll only while true. Toggling true→false stops; false→true restarts. */
  enabled: boolean;
  /** Called on each tick. Awaited, so ticks never overlap. Return value ignored. */
  onPoll: () => unknown | Promise<unknown>;
  /** First interval (ms). Default 3000. */
  baseMs?: number;
  /** Interval cap (ms). Default 30000. */
  maxMs?: number;
  /** Backoff growth factor per tick. Default 1.5. */
  factor?: number;
  /** Pause while the tab is hidden; poll immediately on return. Default true. */
  pauseWhenHidden?: boolean;
}

/**
 * Adaptive polling with exponential backoff and background-tab pausing.
 *
 * Why: the review/summary screens previously polled at a fixed 4s forever. A
 * job that takes a while — or is stuck — meant every open tab hammered the API
 * 15×/min indefinitely, including tabs the doctor had left in the background.
 * Across many concurrent users that is pure wasted load (and mobile battery).
 *
 * This hook keeps the UI responsive early (fast first polls) then eases off
 * (capped backoff), and stops entirely while the tab is hidden — firing one
 * immediate catch-up poll and resetting the backoff when it becomes visible.
 * A recursive setTimeout (not setInterval) guarantees the previous poll
 * resolves before the next is scheduled, so slow requests never stack up.
 */
export function usePolling({
  enabled,
  onPoll,
  baseMs = 3000,
  maxMs = 30000,
  factor = 1.5,
  pauseWhenHidden = true,
}: PollingOptions): void {
  // Keep the latest callback without resubscribing the loop each render.
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = baseMs;

    const hidden = () =>
      pauseWhenHidden &&
      typeof document !== "undefined" &&
      document.visibilityState === "hidden";

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (cancelled) return;
      if (hidden()) {
        // Re-check shortly; don't hit the network while backgrounded.
        timer = setTimeout(tick, baseMs);
        return;
      }
      try {
        await onPollRef.current();
      } finally {
        if (!cancelled) {
          delay = Math.min(maxMs, delay * factor);
          schedule();
        }
      }
    };

    const onVisible = () => {
      if (cancelled || hidden()) return;
      // Back in view: reset backoff and catch up immediately.
      if (timer) clearTimeout(timer);
      delay = baseMs;
      void tick();
    };

    if (pauseWhenHidden && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (pauseWhenHidden && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [enabled, baseMs, maxMs, factor, pauseWhenHidden]);
}
