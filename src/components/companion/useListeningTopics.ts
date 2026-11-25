"use client";

import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { HotItem } from "@/types";
import { createListeningSession, type ListeningLine } from "@/lib/listening-topics";

type Options = {
  hot: readonly HotItem[];
  live: boolean;
  /** Only the open cabin's key. A closed cabin must pass null, not the last book key. */
  roomKey: string | null;
  onLine?: (line: ListeningLine, roomKey: string) => void;
};

/** stop() on draft/IME start; cancel() at the start of a fold or table switch, before animations. */
export function useListeningTopics(options: Options) {
  const { roomKey } = options;
  const latest = useRef(options);
  const mounted = useRef<ReturnType<typeof createListeningSession> | null>(null);
  useLayoutEffect(() => {
    latest.current = options;
  });

  const session = useMemo(() => {
    const instance = createListeningSession({
      getFeed: () => latest.current,
      canSpeak: (): boolean =>
        roomKey !== null && mounted.current === instance && document.visibilityState === "visible",
      onLine: (line) => {
        if (roomKey !== null) latest.current.onLine?.(line, roomKey);
      },
    });
    return instance;
  }, [roomKey]);

  useLayoutEffect(() => {
    mounted.current = session;
    if (roomKey === null)
      return () => {
        mounted.current = null;
        session.cancel();
      };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") session.stop();
    };
    // Catch native editing/composition before React updates the parent's draft. No draft is read.
    const onEdit = (e: Event) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || e.target.matches("textarea, input"))
      )
        session.stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("beforeinput", onEdit, true);
    document.addEventListener("compositionstart", onEdit, true);
    window.addEventListener("pagehide", session.stop);
    return () => {
      mounted.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("beforeinput", onEdit, true);
      document.removeEventListener("compositionstart", onEdit, true);
      window.removeEventListener("pagehide", session.stop);
      session.cancel();
    };
  }, [session, roomKey]);

  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return {
    ...state,
    handleText: session.handleText,
    pickHot: session.pickHot,
    findScope: session.findScope,
    step: session.step,
    nextTopic: session.nextTopic,
    previousTopic: session.previousTopic,
    listen: session.listen,
    stop: session.stop,
    cancel: session.cancel,
  };
}
export type ListeningDeskModel = ReturnType<typeof useListeningTopics>;
