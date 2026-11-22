"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUp, BookOpen, MessageSquare, Feather, X } from "lucide-react";
import { BookmarkTicket } from "@/components/companion/PassageBookmark";
import type { PassageBookmark, QuoteRef } from "@/types";
import { art } from "@/lib/art";
import { names, type Room } from "@/lib/companion";
import { PaperDialog } from "@/components/companion/PaperDialog";
import { RoomScene, Evidence, Sources } from "./AnimalStage";
import { ControlCard } from "./ControlCard";

export function CabinModal({
  room,
  loading,
  error,
  draft,
  setDraft,
  onClose,
  onRetry,
  onNext,
  onSay,
  onChoose,
  onCommit,
  onLocate,
  choosing,
}: {
  room?: Room;
  loading: boolean;
  error: string | null;
  draft: string;
  setDraft: (s: string) => void;
  onClose: () => void;
  onRetry: () => void;
  onNext: () => void;
  onSay: (s: string) => void;
  onChoose: (c: { id: string; label: string }) => void;
  onCommit: () => void;
  onLocate: (m: PassageBookmark) => void;
  choosing: boolean;
}) {
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const closing = useRef(0);
  function fold() {
    if (leaving) return;
    if (reduced) {
      onClose();
      return;
    }
    setLeaving(true);
    closing.current = window.setTimeout(onClose, 340);
  }
  useEffect(() => () => clearTimeout(closing.current), []);
  const [settled, setSettled] = useState(!!room?.turns.length || !!reduced),
    [cardOpen, setCardOpen] = useState(!!room?.committed),
    [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLDivElement>(null),
    flow = useRef<HTMLDivElement>(null),
    cardRef = useRef<HTMLDivElement>(null),
    composing = useRef(false);
  useEffect(() => {
    if (settled) return;
    if (reduced) {
      setSettled(true);
      return;
    }
    const timer = setTimeout(() => setSettled(true), 2320);
    return () => clearTimeout(timer);
  }, [settled, reduced]);
  const r = room?.result,
    turns = room?.turns,
    started = !!room?.cursor;
  const line = turns?.findLast((t) => t.speaker !== "user");
  const count = turns?.length ?? 0,
    finished = !!room && !!r && room.cursor >= r.dialogues.length;
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [count, showLog]);
  useEffect(() => {
    if (cardOpen) cardRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [cardOpen]);
  function locateQuote(q: QuoteRef) {
    const m = room?.bookmark;
    return m && q.kind === "bookmark" && q.sourceUrl === m.url && q.excerpt === m.excerpt
      ? () => onLocate(m)
      : undefined;
  }
  const pinnedEvidence = !!(line?.quoteRef && locateQuote(line.quoteRef));
  const inputs = !!room && started;
  function submit() {
    if (!inputs || !draft.trim() || composing.current) return;
    onSay(draft);
    setDraft("");
  }
  return (
    <PaperDialog
      label="毛茸茸小屋"
      className={"room-dialog" + (leaving ? " folding" : "")}
      onClose={fold}
    >
      <div
        className="cabin-paper"
        inert={leaving}
        style={{ backgroundImage: `url("${art.shell}"), url("${art.clouds}")` }}
      >
        <div className="roof-words">THE READING ROOM</div>
        <header className="room-title">
          <h2>毛茸茸圆桌</h2>
          <button className="icon-b" onClick={fold} aria-label="关闭小屋">
            <X size={17} />
          </button>
        </header>
        <div className="room-context">
          <BookOpen size={14} />
          <span>{room?.context.at(-1)?.origin === "sample" ? "本地试读" : "刚刚读到"}</span>
          <b>{room?.title ?? "还没有夹上书签"}</b>
        </div>
        <div className="room-flow" ref={flow}>
          <RoomScene line={line} settled={settled} />
          {room?.bookmark && (
            <BookmarkTicket
              verified={pinnedEvidence}
              mark={room.bookmark}
              onLocate={() => onLocate(room.bookmark!)}
            />
          )}
          {!room ? (
            <div className="gather-note">
              <small>窗边的看山</small>
              <p>书页还是空的。先去读一篇回答，等你回来，我们就从那篇聊起。</p>
            </div>
          ) : !started && room.bookmark ? null : !started ? (
            <div className="gather-note">
              <small>
                <Feather size={13} /> 看山抄下这一句
              </small>
              <p>
                {room.context.at(-1)?.contentText.trim().slice(0, 76) || room.context.at(-1)?.title}
              </p>
              <span>本轮带进来 {room.context.length} 篇。你来决定什么时候开聊。</span>
            </div>
          ) : (
            <>
              {line?.quoteRef && !pinnedEvidence && (
                <Evidence quote={line.quoteRef} onLocate={locateQuote(line.quoteRef)} />
              )}
              {line?.speaker === "shiba" && r && <Sources sources={r.curatedSources} />}
              <div className="transcript">
                <div className="transcript-head">
                  <strong>
                    <MessageSquare size={15} /> 聊天记录
                  </strong>
                  <button onClick={() => setShowLog(!showLog)} aria-expanded={showLog}>
                    {showLog ? "收起" : "展开全部"} · {count}
                  </button>
                </div>
                <div
                  className={"chat-log " + (showLog ? "full" : "")}
                  ref={logRef}
                  role="log"
                  aria-label="聊天记录"
                  aria-live="off"
                >
                  {(showLog ? turns : turns?.slice(-2))?.map((m) => (
                    <div
                      key={m.id}
                      data-kind={m.kind}
                      className={m.speaker === "user" ? "user-line" : ""}
                    >
                      <b>
                        {m.speaker === "user" ? "你" : names[m.speaker]}
                        {m.kind === "note" ? " · 主动便签" : ""}
                      </b>
                      <span>{m.text}</span>
                      {showLog && m.quoteRef && (
                        <Evidence quote={m.quoteRef} onLocate={locateQuote(m.quoteRef)} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {room && r && started && (
            <details className="context-details">
              <summary>本轮阅读与原帖 · {room.context.length}</summary>
              {room.context.map((t) => (
                <a key={t.url} href={t.url} target="_blank" rel="noreferrer">
                  {t.title} ↗
                </a>
              ))}
              <p>
                {r.radar.summaryTag}
                {room.context.at(-1)?.origin !== "sample" &&
                  ` · 干货 ${r.radar.drynessScore} / 情绪 ${r.radar.anxietyScore} / 引流线索 ${r.radar.adRiskScore}`}
              </p>
              {r.meta.degraded && <p>{r.meta.note || "本轮仅使用已取得的材料。"}</p>}
            </details>
          )}
          {cardOpen && room && finished && (
            <div ref={cardRef}>
              <ControlCard room={room} busy={choosing} onChoose={onChoose} onCommit={onCommit} />
            </div>
          )}
          {error && (
            <p className="room-error" role="status">
              {error} {room && !r && <button onClick={onRetry}>再试一次</button>}
            </p>
          )}
        </div>
        <footer className="room-footer">
          {!room ? (
            <button className="room-continue" onClick={fold}>
              回去读一篇 <ArrowRight size={17} />
            </button>
          ) : !settled ? (
            <button className="room-continue" onClick={() => setSettled(true)}>
              跳过入场 <ArrowRight size={17} />
            </button>
          ) : !started ? (
            <button className="room-continue" disabled={!r || loading} onClick={onNext}>
              {loading ? "看山正在翻阅原帖…" : r ? "开聊 · 听呼噜猫说" : "等待原帖整理"}{" "}
              <ArrowRight size={17} />
            </button>
          ) : (
            <>
              {!finished ? (
                <button
                  className="room-continue"
                  onClick={() => {
                    setShowLog(false);
                    onNext();
                    flow.current?.scrollTo({ top: 0 });
                  }}
                >
                  听下一句{" "}
                  <small>
                    {room.cursor} / {r?.dialogues.length}
                  </small>
                  <ArrowRight size={15} />
                </button>
              ) : (
                !cardOpen && (
                  <button className="room-continue" onClick={() => setCardOpen(true)}>
                    接过看山的掌控卡 <ArrowRight size={15} />
                  </button>
                )
              )}
              <form
                className="chat-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <input
                  value={draft}
                  maxLength={400}
                  onCompositionStart={() => {
                    composing.current = true;
                  }}
                  onCompositionEnd={() => {
                    composing.current = false;
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (e.nativeEvent.isComposing ||
                        e.nativeEvent.keyCode === 229 ||
                        composing.current)
                    )
                      e.preventDefault();
                  }}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="我也说一句"
                  placeholder="我也说一句…"
                />
                <button disabled={!draft.trim()} aria-label="发送消息">
                  <ArrowUp size={18} />
                </button>
              </form>
            </>
          )}
        </footer>
      </div>
    </PaperDialog>
  );
}
