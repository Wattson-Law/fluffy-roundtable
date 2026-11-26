"use client";
import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { ExternalLink, MessageSquareText, Quote } from "lucide-react";
import { art } from "@/lib/art";
import { names, type Turn } from "@/lib/companion";
import type { CuratedSource, QuoteRef, Speaker } from "@/types";

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
    <div className={"gather-scene " + (settled ? "at-rest" : "arriving")} aria-hidden="true">
      <img className="room-table" src={art.roundTable} alt="" />
      <img className="room-host" src={art.ink[0]} alt="" />
      <img className="arr-owl" src={art.entry.owl[frame(340, 1690)]} alt="" />
      <img className="arr-cat" src={art.entry.cat[frame(610, 1880)]} alt="" />
      <img className="arr-dog" src={art.entry.dog[frame(870, 2180)]} alt="" />
    </div>
  );
}
// Seats never change keys: a handoff changes the pose in place, not the cast of the room.
const seats: Speaker[] = ["owl", "purr_cat", "kanshan", "shiba"];

export function RoomScene({
  speaker,
  nudgedPet,
  settled,
  onAddress,
}: {
  nudgedPet: Speaker | null;
  speaker?: Turn["speaker"];
  settled: boolean;
  onAddress: (pet: Speaker) => void;
}) {
  const reduced = useReducedMotion();
  const label = !speaker
    ? "伙伴入座"
    : speaker === "user"
      ? "伙伴在听你说"
      : `${names[speaker]} · 接话`;
  return (
    <div
      className={`room-scene ${speaker ? "at-table" : "is-gathering"}`}
      style={{ backgroundImage: `url("${art.room}")` }}
      role={speaker ? "group" : "img"}
      aria-label={!speaker ? "看山在桌边，伙伴们来到小屋" : `四位伙伴同桌。${label}`}
    >
      <span className="scene-label" data-speaker={speaker ?? "gather"} aria-hidden="true">
        <i />
        {label}
      </span>
      <Entrance settled={settled || !!speaker || !!reduced} />
      <div className="table-ensemble" inert={!speaker} aria-hidden={!speaker}>
        {seats.map((pet) => (
          <button
            type="button"
            key={pet}
            className="bench-seat"
            data-speaker={pet}
            data-active={speaker === pet}
            data-nudged={nudgedPet === pet}
            aria-label={`和${names[pet]}说句话`}
            title={`把话递给${names[pet]}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAddress(pet)}
          >
            <span className="seat-performance" aria-hidden="true">
              <img className="pose-rest" src={art.resting[pet]} alt="" draggable={false} />
              <img className="pose-talk" src={art.portrait[pet]} alt="" draggable={false} />
            </span>
            <MessageSquareText
              className="seat-voice"
              size={21}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>
        ))}
        <img className="bench-table" src={art.roundTable} alt="" draggable={false} />
      </div>
    </div>
  );
}
export function Evidence({ quote, onLocate }: { quote: QuoteRef; onLocate?: () => void }) {
  const label = (
    <>
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
    </>
  );
  return onLocate ? (
    <button className="evidence-card" onClick={onLocate} title="回到这句原文">
      {label}
    </button>
  ) : (
    <a className="evidence-card" href={quote.sourceUrl} target="_blank" rel="noreferrer">
      {label}
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
