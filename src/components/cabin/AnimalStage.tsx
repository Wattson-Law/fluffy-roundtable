"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Quote } from "lucide-react";
import { art } from "@/lib/art";
import { duties, names, type Turn } from "@/lib/companion";
import type { CuratedSource, QuoteRef } from "@/types";

function Entrance({ settled }: { settled: boolean }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (settled) return;
    const start = performance.now();
    const id = setInterval(() => setMs(performance.now() - start), 110);
    return () => clearInterval(id);
  }, [settled]);
  function frame(start: number, end: number) {
    return settled || ms >= end ? 3 : [0, 1, 2, 1][Math.max(0, Math.floor((ms - start) / 115)) % 4];
  }
  return (
    <div
      className={"gather-scene " + (settled ? "at-rest" : "arriving")}
      aria-label="看山在桌边写字，猫头鹰飞向圆窗，呼噜猫和柴犬跑向桌边"
      role="img"
    >
      <img className="room-table" src={art.table} alt="" />
      <img className="room-host" src={art.ink[0]} alt="" />
      <img className="arr-owl" src={art.entry.owl[frame(340, 1690)]} alt="" />
      <img className="arr-cat" src={art.entry.cat[frame(610, 1880)]} alt="" />
      <img className="arr-dog" src={art.entry.dog[frame(870, 2180)]} alt="" />
    </div>
  );
}
export function RoomScene({ line, settled }: { line?: Turn; settled: boolean }) {
  const reduced = useReducedMotion();
  const speaker = line?.speaker === "user" ? undefined : line?.speaker;
  const [shown, setShown] = useState(line);
  const latest = useRef(line);
  useEffect(() => {
    latest.current = line;
    if (reduced || !shown || !line || line.speaker === shown.speaker) setShown(line);
  }, [line, reduced, shown?.speaker]);
  const caption = reduced || !shown || shown.speaker === line?.speaker ? line : shown;
  const voice = caption?.speaker === "user" ? undefined : caption?.speaker;
  return (
    <div
      className={"room-scene " + (speaker ? "is-speaking" : "is-gathering")}
      style={{ backgroundImage: `url("${art.room}")` }}
    >
      <span className="scene-label">
        <i />
        {speaker ? "圆桌现场" : "伙伴入座"}
      </span>
      {!speaker || !line || !caption || !voice ? (
        <Entrance settled={settled || !!reduced} />
      ) : (
        <div className="scene-talk">
          <div className="portrait-slot">
            <AnimatePresence
              mode="wait"
              initial={false}
              onExitComplete={() => setShown(latest.current)}
            >
              <motion.img
                key={speaker}
                src={art.portrait[speaker]}
                alt={`${names[speaker]}的发言立绘`}
                initial={reduced ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5, transition: { duration: reduced ? 0 : 0.41 } }}
                transition={{ duration: reduced ? 0 : 0.71 }}
              />
            </AnimatePresence>
          </div>
          <div className="speech-paper" data-speaker={voice} aria-live="polite">
            <strong>{names[voice]}</strong>
            <small>{duties[voice]}</small>
            <p>{caption.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
export function Evidence({ quote }: { quote: QuoteRef }) {
  return (
    <a className="evidence-card" href={quote.sourceUrl} target="_blank" rel="noreferrer">
      <small>
        <Quote size={12} /> {quote.reason || "原文摘录"} <ExternalLink size={12} />
      </small>
      <q>{quote.excerpt}</q>
      <span>
        {[quote.sourceAuthor && `@${quote.sourceAuthor}`, quote.sourceTitle]
          .filter(Boolean)
          .join(" · ")}{" "}
        ↗
      </span>
    </a>
  );
}
export function Sources({ sources }: { sources: CuratedSource[] }) {
  if (!sources.length) return null;
  return (
    <div className="source-list">
      <small>柴犬找到的其他声音 · {sources.length} 篇</small>
      {sources.map((s) => (
        <a href={s.url} key={s.url} target="_blank" rel="noreferrer">
          <strong>{s.title} ↗</strong>
          <span>
            @{s.author} · {s.why}
          </span>
        </a>
      ))}
    </div>
  );
}
