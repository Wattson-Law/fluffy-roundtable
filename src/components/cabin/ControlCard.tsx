"use client";
import { BookmarkCheck, Feather } from "lucide-react";
import type { Room } from "@/lib/companion";
export function ControlCard({
  room,
  busy,
  onChoose,
  onCommit,
  onOpenJournal,
}: {
  room: Room;
  busy: boolean;
  onChoose: (c: { id: string; label: string }) => void;
  onCommit: () => void;
  onOpenJournal?: () => void;
}) {
  const r = room.result;
  if (!r) return null;
  const card = r.controlCard;
  return (
    <section className="decision-paper" data-committed={!!room.committed} aria-label="掌控卡">
      <small>
        <Feather size={14} /> 刘看山的手写卡 <span className="letter-meta">3 MIN CARD</span>
      </small>
      {room.committed && <span className="committed-stamp" aria-hidden="true">已落章</span>}
      <h3>3 分钟最小掌控卡</h3>
      <p>{card.oneLineTakeaway}</p>
      <div className="micro">
        <b>今天可以做的一件小事</b>
        <p>{room.followUp?.microAction ?? card.microAction}</p>
      </div>
      {r.followUpQuestion && !room.followUp && !room.committed && (
        <div className="choice-box">
          <p>{r.followUpQuestion.prompt}</p>
          {r.followUpQuestion.choices.map((c) => (
            <button key={c.id} disabled={busy} onClick={() => onChoose(c)}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="letter-signoff">陪你一起，刘看山</div>
      <button className="forest-button" disabled={room.committed || busy} onClick={onCommit}>
        <BookmarkCheck size={15} />
        {room.committed ? "已收进猫咖手账" : "我拍板，收进手账"}
      </button>
      {room.committed && onOpenJournal && (
        <button className="journal-link" onClick={onOpenJournal}>翻开猫咖手账 →</button>
      )}
    </section>
  );
}
