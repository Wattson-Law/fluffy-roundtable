"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { art } from "@/lib/art";
import walkingCat from "../../../assets/action-poses/v1/poses/ginger-cat-walking.png";

export function KanshanDock({
  count,
  onOpen,
  invited,
  onNote,
  onDismiss,
}: {
  count: number;
  onOpen: () => void;
  invited: boolean;
  onNote: () => void;
  onDismiss: () => void;
}) {
  const reduced = useReducedMotion();
  const [wakeFrame, setWakeFrame] = useState<number | null>(null);
  const wakeTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!reduced) art.wake.forEach((src) => { new Image().src = src; });
  }, [reduced]);
  useEffect(() => () => {
    if (wakeTimer.current !== null) clearTimeout(wakeTimer.current);
  }, []);
  function wake() {
    if (wakeTimer.current !== null) return;
    if (reduced) { onOpen(); return; }
    function step(i: number) {
      if (i === art.wake.length) {
        wakeTimer.current = null;
        setWakeFrame(null);
        onOpen();
      } else {
        setWakeFrame(i);
        wakeTimer.current = window.setTimeout(() => step(i + 1), 28);
      }
    }
    step(0);
  }
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let i = 0;
    const seq = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0];
    let id: ReturnType<typeof setTimeout>;
    function tick() {
      if (document.visibilityState !== "visible") return;
      setFrame(seq[i]);
      i = (i + 1) % seq.length;
      id = setTimeout(tick, i === 0 ? 3600 : 125);
    }
    function restart() {
      clearTimeout(id);
      if (document.visibilityState === "visible") tick();
    }
    restart();
    document.addEventListener("visibilitychange", restart);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", restart);
    };
  }, [reduced]);
  return (
    <aside className="window-dock" aria-label="窗边伙伴">
      {invited && (
        <section className="cat-note" aria-label="呼噜猫的便签" aria-live="polite">
          <div className="note-label">
            <img src={walkingCat.src} alt="呼噜猫踱过来送便签" />
            呼噜猫留了一张便签
            <button aria-label="收起便签" onClick={onDismiss}>
              <X size={15} />
            </button>
          </div>
          <p>有空聊两句吗？</p>
          <div>
            <button onClick={onNote}>
              回猫猫一句 <ArrowUpRight size={13} />
            </button>
            <button onClick={onDismiss}>先不聊</button>
          </div>
        </section>
      )}
      {count > 0 && !invited && (
        <p className="dock-whisper" aria-hidden="true" onClick={wake}>刚记下 {count} 篇，想聊点我</p>
      )}
      <button className="window-pet" data-waking={wakeFrame !== null} onClick={wake} aria-label="打开毛茸茸小屋">
        <img
          className="pet-ink"
          src={wakeFrame === null ? art.ink[reduced ? 0 : frame] : art.wake[wakeFrame]}
          alt="刘看山伏在窗沿，用黑爪扶着书写字"
        />
        <img className="pet-rail" src={art.rail} alt="" />
        <span className="pet-caption">
          <i /> 进小屋{count > 0 && <b>{count}</b>}
        </span>
      </button>
    </aside>
  );
}
