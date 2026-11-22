"use client";
import { X, BookHeart } from "lucide-react";
import { BookmarkTicket } from "@/components/companion/PassageBookmark";
import type { JournalEntry, PassageBookmark } from "@/types";
import { art } from "@/lib/art";
import { PaperDialog } from "@/components/companion/PaperDialog";
import { dateLabel } from "@/components/companion/ReadingNotebook";
export function CatJournalDrawer({
  onClose,
  entries,
  onLocate,
}: {
  onClose: () => void;
  entries: JournalEntry[];
  onLocate: (m: PassageBookmark) => void;
}) {
  return (
    <PaperDialog label="猫咖手账" className="shelf-dialog" onClose={onClose}>
      <div className="shelf-content">
        <header className="sheet-header">
          <div>
            <div className="kicker">THE CAT JOURNAL</div>
            <h2>猫咖手账</h2>
          </div>
          <button className="icon-b" onClick={onClose} aria-label="关闭手账">
            <X size={18} />
          </button>
        </header>
        <div className="shelf-list">
          <p className="muted">只收下你亲自拍板的卡片。一起读过的原帖，也会夹在卡片里。</p>
          {!entries.length ? (
            <div className="shelf-empty">
              <img src={art.sleeping} alt="睡着的呼噜猫" />
              <p>第一张卡片的位置，给你留着。</p>
            </div>
          ) : (
            entries.map((e) => (
              <article key={e.id} className="decision-paper journal-entry">
                <small>
                  <BookHeart size={13} />
                  {dateLabel(e.createdAt)} · {e.catBadgeName}
                </small>
                <h3>{e.topicTitle}</h3>
                <p>{e.oneLineTakeaway}</p>
                <div className="micro">
                  <b>记下的小行动</b>
                  <p>{e.microAction}</p>
                </div>
                {e.bookmark && <BookmarkTicket mark={e.bookmark} onLocate={() => onLocate(e.bookmark!)} />}
                <div className="source-list">
                  {e.sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noreferrer">
                      {s.title} ↗
                    </a>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </PaperDialog>
  );
}
