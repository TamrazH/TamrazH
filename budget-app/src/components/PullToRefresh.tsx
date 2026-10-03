"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const THRESHOLD = 70;
const MAX_PULL = 110;

/**
 * Səhifənin yuxarısında aşağı çəkərək yeniləmə. Yalnız scrollY==0 olduqda və şaquli jest zamanı aktivləşir.
 * Passiv hadisələrdən istifadə edir; scroll-u bloklamır.
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<{ y: number; x: number } | null>(null);
  const pullRef = useRef(0);
  const busy = useRef(false);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || window.scrollY > 0 || busy.current) return;
      // Açıq dialoq/sheet daxilində işləməsin
      if ((e.target as HTMLElement | null)?.closest('[role="dialog"]')) return;
      start.current = { y: t.clientY, x: t.clientX };
    };
    const onMove = (e: TouchEvent) => {
      const s = start.current;
      const t = e.touches[0];
      if (!s || !t) return;
      const dy = t.clientY - s.y;
      const dx = Math.abs(t.clientX - s.x);
      if (dy <= 0 || dx > dy || window.scrollY > 0) {
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      const damped = Math.min(MAX_PULL, dy * 0.5);
      pullRef.current = damped;
      setPull(damped);
    };
    const onEnd = async () => {
      const p = pullRef.current;
      start.current = null;
      pullRef.current = 0;
      if (p >= THRESHOLD && !busy.current) {
        busy.current = true;
        setRefreshing(true);
        setPull(THRESHOLD * 0.7);
        try {
          await refresh.current();
        } finally {
          busy.current = false;
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const active = pull > 8 || refreshing;
  return (
    <div>
      <div
        aria-hidden={!active}
        className="flex items-end justify-center overflow-hidden text-[13px] font-medium text-slate-500 dark:text-slate-400"
        style={{ height: pull, transition: start.current ? "none" : "height 0.2s ease" }}
      >
        {active && (
          <span className="mb-2 flex items-center gap-2">
            <span
              className={`h-4 w-4 rounded-full border-2 border-brand-500 border-t-transparent ${refreshing ? "animate-spin" : ""}`}
              style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }}
            />
            {refreshing ? "Yenilənir…" : pull >= THRESHOLD ? "Buraxın" : "Yeniləmək üçün çəkin"}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
