"use client";
import { useEffect, useRef } from "react";
import { catCheckIn } from "@/lib/companion";
import { updateBook } from "@/lib/storage";

/** A visible page delivers local notes, never asks for notifications or transmits chat. */
export function useCatDelivery(flags: { activeKey: string | null; busy: boolean }) {
  const latest = useRef(flags);
  useEffect(() => {
    latest.current = flags;
  }, [flags]);
  useEffect(() => {
    let quietUntil = Date.now() + 15_000,
      alive = true;
    const activity = () => {
      quietUntil = Date.now() + 15_000;
    };
    const deliver = () => {
      if (!alive || document.visibilityState !== "visible" || Date.now() < quietUntil) return;
      const editor = document.activeElement;
      const typing =
        (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) &&
        !!editor.value.trim();
      const env = {
        visible: true,
        busy: latest.current.busy || typing || window.getSelection()?.isCollapsed === false,
        activeKey: latest.current.activeKey,
      };
      if (!env.busy) updateBook((b) => catCheckIn(b, Date.now(), env));
    };
    const tick = () => {
      if (document.visibilityState !== "visible" || latest.current.busy || Date.now() < quietUntil)
        return;
      if (navigator.locks)
        void navigator.locks
          .request("fr.cat-note-delivery", { ifAvailable: true }, (lock) => {
            if (lock) deliver();
          })
          .catch(() => {});
      else deliver();
    };
    const handle = window.setInterval(tick, 5000);
    document.addEventListener("visibilitychange", activity);
    document.addEventListener("keydown", activity, true);
    document.addEventListener("scroll", activity, true);
    document.addEventListener("pointerdown", activity, true);
    return () => {
      alive = false;
      clearInterval(handle);
      document.removeEventListener("visibilitychange", activity);
      document.removeEventListener("keydown", activity, true);
      document.removeEventListener("scroll", activity, true);
      document.removeEventListener("pointerdown", activity, true);
    };
  }, []);
}
