"use client";
import { useCallback, useEffect, useRef } from "react";
import type { ZhihuItem } from "@/types";

/** At most one card at the reading line accrues dwell time. Hidden and covered time never counts. */
export function useReadingTracker(
  items: ZhihuItem[],
  active: boolean,
  onRead: (item: ZhihuItem) => void,
) {
  const list = useRef<HTMLDivElement>(null),
    seen = useRef(new Set<string>());
  const record = useCallback(
    (item: ZhihuItem) => {
      if (!active || document.visibilityState !== "visible" || seen.current.has(item.url)) return;
      seen.current.add(item.url);
      onRead(item);
    },
    [active, onRead],
  );
  useEffect(() => {
    if (!active || !list.current || !items.length) return;
    const root = list.current;
    let target: ZhihuItem | null = null,
      timer = 0,
      frame = 0;
    const cancel = () => {
      window.clearTimeout(timer);
      target = null;
    };
    function candidate(): ZhihuItem | null {
      if (document.visibilityState !== "visible" || document.querySelector("dialog[open]")) return null;
      const top = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
        bottom = window.innerHeight,
        guide = top + (bottom - top) * 0.36;
      let best: ZhihuItem | null = null,
        score = Infinity;
      for (const el of root.querySelectorAll<HTMLElement>("article[data-read-index]")) {
        const r = el.getBoundingClientRect(),
          visible = Math.min(bottom, r.bottom) - Math.max(top, r.top);
        if (visible <= 0 || visible < 0.5 * Math.min(r.height, bottom - top)) continue;
        const distance = Math.abs(guide - Math.max(r.top, Math.min(guide, r.bottom)));
        if (distance < score) {
          score = distance;
          best = items[Number(el.dataset.readIndex)];
        }
      }
      return best;
    }
    function assess() {
      const best = candidate();
      if (best === target) return;
      cancel();
      target = best;
      if (best && !seen.current.has(best.url))
        timer = window.setTimeout(() => {
          if (candidate() === best) record(best);
          else assess();
        }, 2500);
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(assess);
    }
    function visibility() {
      cancel();
      schedule();
    }
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(schedule, { threshold: [0, 0.5, 1] })
        : null;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    ro?.observe(root);
    root.querySelectorAll("article").forEach((el) => io?.observe(el));
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancel();
      cancelAnimationFrame(frame);
      io?.disconnect();
      ro?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [items, active, record]);
  return { list, record };
}
