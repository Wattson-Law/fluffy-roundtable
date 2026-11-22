"use client";
import { useEffect, useRef } from "react";
import { ArrowLeft, Bookmark, ExternalLink } from "lucide-react";
import { locatePassage } from "@/lib/bookmarks";
import { PaperDialog } from "./PaperDialog";
import type { PassageBookmark } from "@/types";

export function BookmarkTicket({
  mark,
  onLocate,
  verified = false,
}: {
  mark: PassageBookmark;
  onLocate: () => void;
  verified?: boolean;
}) {
  return (
    <button
      type="button"
      className={`bookmark-ticket${verified ? " evidence-card" : ""}`}
      aria-label="回到原段"
      onClick={onLocate}
    >
      <small>
        <Bookmark size={13} />
        {verified ? "猫头鹰核对过的原句" : "你夹的那一句"}
      </small>
      <q>{mark.excerpt}</q>
      <span className="ticket-foot">
        <span>{verified && `${mark.origin ? "试读正文" : "作者正文"} · @${mark.author}`}</span>
        <span className="ticket-link">回到原段 ↗</span>
      </span>
    </button>
  );
}

/** Keep the underlying cabin/journal mounted, including the reader's scroll, turn and draft. */
export function PassageDialog({
  mark,
  body,
  onClose,
}: {
  mark: PassageBookmark;
  body?: string;
  onClose: () => void;
}) {
  const offset = body ? locatePassage(body, mark) : null;
  const located = offset !== null && body !== undefined,
    highlight = useRef<HTMLElement>(null);
  useEffect(() => {
    highlight.current?.scrollIntoView({ block: "center", behavior: "instant" });
    highlight.current?.focus({ preventScroll: true });
  }, []);
  return (
    <PaperDialog label="书签原段" className="shelf-dialog passage-dialog" onClose={onClose}>
      <div className="shelf-content">
        <header className="sheet-header">
          <div>
            <div className="kicker">IN THE MARGIN</div>
            <h2>书签原段</h2>
          </div>
          <button className="icon-b" aria-label="返回刚才的位置" onClick={onClose}>
            <ArrowLeft size={18} />
          </button>
        </header>
        <article className="passage-sheet">
          <small>
            {mark.origin === "sample" ? "本地试读" : "知乎原文"} · @{mark.author}
          </small>
          <h3>{mark.title}</h3>
          <p className="passage-state">{located ? "已定位到正文" : "夹签时保存的摘录"}</p>
          {!located && (
            <p className="muted">当前没有可准确定位的全文。下面是夹签时留下的前后文。</p>
          )}
          <div className="passage-scroll">
            {located ? body.slice(0, offset) : mark.before}
            <mark ref={highlight} tabIndex={-1}>
              {mark.excerpt}
            </mark>
            {located ? body.slice(offset + mark.excerpt.length) : mark.after}
          </div>
          {!mark.origin && (
            <a href={mark.url} target="_blank" rel="noreferrer">
              打开知乎原帖 <ExternalLink size={13} />
            </a>
          )}
        </article>
        <button className="passage-back" onClick={onClose}>
          <ArrowLeft size={15} /> 回到刚才的位置
        </button>
      </div>
    </PaperDialog>
  );
}
