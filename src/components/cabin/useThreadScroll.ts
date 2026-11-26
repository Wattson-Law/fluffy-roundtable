import { useLayoutEffect, useRef, useState } from "react";
import type { Turn } from "@/lib/companion";

/** One scroll surface for messages and desk tools. A new turn must not take it away from a reader. */
export function useThreadScroll(turns?: Turn[]) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [leftAt, setLeftAt] = useState<string | null>(null);
  const tail = turns?.at(-1)?.id;

  function followLatest() {
    following.current = true;
    setLeftAt(null);
    const el = viewport.current;
    if (el) el.scrollTop = el.scrollHeight;
  }
  function markAway() {
    following.current = false;
    setLeftAt((id) => id ?? tail ?? null);
  }
  function onScroll() {
    const el = viewport.current;
    if (!el || !tail) return;
    // Focusing a partly visible avatar can reveal one face without leaving the latest turn.
    const tailSlop = Math.min(40, el.clientHeight * 0.2);
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= tailSlop) {
      following.current = true;
      setLeftAt(null);
    } else {
      markAway();
    }
  }
  function showDesk() {
    markAway();
    viewport.current?.scrollTo({ top: 0 });
    viewport.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    const el = viewport.current;
    if (el && tail && following.current) el.scrollTop = el.scrollHeight;
  }, [tail]); // IDs still change when a full, bounded history drops its oldest turn.

  const started = !!tail;
  useLayoutEffect(() => {
    const el = viewport.current,
      inner = content.current;
    if (!started || !el || !inner) return;
    const observer = new ResizeObserver(() => {
      if (following.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el); // keyboard, orientation, the gathering scene settling into its band
    observer.observe(inner); // opened references and late-loading art
    return () => observer.disconnect();
  }, [started]);

  const index = turns?.findIndex((t) => t.id === leftAt) ?? -1;
  const unread = leftAt && turns ? turns.length - index - 1 : 0;
  return {
    viewport,
    content,
    onScroll,
    followLatest,
    markAway,
    showDesk,
    away: leftAt !== null,
    unread,
  };
}
