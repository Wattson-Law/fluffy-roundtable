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

type ArticleControls = {
  loading: boolean;
  error: string | null;
  onPersonal: () => void;
  onRetry: () => void;
  onNext: () => void;
  onChoose: (c: { id: string; label: string }) => void;
  onCommit: () => void;
  onLocate: (m: PassageBookmark) => void;
  choosing: boolean;
};

export function CabinModal({
  room,
  draft,
  setDraft,
  onClose,
  onFoldStart,
  onDraftStart,
  onSay,
  article,
}: {
  room?: Room;
  draft: string;
  setDraft: (s: string) => void;
  onClose: () => void;
  onFoldStart?: () => void;
  onDraftStart?: () => void;
  onSay: (s: string) => void;
  article?: ArticleControls;
}) {
  const { loading, error } = article ?? {};
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const closing = useRef(0);
  function fold() {
    if (leaving) return;
    onFoldStart?.();
    if (reduced) {
      onClose();
      return;
    }
    setLeaving(true);
    closing.current = window.setTimeout(onClose, 340);
  }
  useEffect(() => () => clearTimeout(closing.current), []);
  const [settled, setSettled] = useState(!!room?.turns.length || !!reduced),
    [cardOpen, setCardOpen] = useState(!!room?.committed && !room?.conversation),
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
    started = !!turns?.length,
    personal = !room?.context.length,
    readerLed = !!room?.conversation || personal;
  const line = turns?.findLast((t) => t.speaker !== "user");
  const count = turns?.length ?? 0,
    finished = !!room && !!r && room.cursor >= r.dialogues.length,
    cardAvailable = !!r && (finished || readerLed);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [count, showLog]);
  useEffect(() => {
    if (cardOpen)
      cardRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
  }, [cardOpen]);
  function locateQuote(q: QuoteRef) {
    const m = room?.bookmark;
    return article && m && q.kind === "bookmark" && q.sourceUrl === m.url && q.excerpt === m.excerpt
      ? () => article.onLocate(m)
      : undefined;
  }
  const pinnedEvidence = !!(line?.quoteRef && locateQuote(line.quoteRef));
  const inputs = !!room && settled && !leaving;
  function submit() {
    if (!inputs || !draft.trim() || composing.current) return;
    setShowLog(false);
    setCardOpen(false);
    flow.current?.scrollTo({ top: 0 });
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
          <span>
            {personal
              ? "不带文章"
              : room?.context.at(-1)?.origin === "sample"
                ? "本地试读"
                : "刚刚读到"}
          </span>
          <b>{room?.title ?? "窗边随聊"}</b>
        </div>
        <div className="room-flow" ref={flow}>
          <RoomScene line={line} settled={settled} />
          {article && room?.bookmark && (!readerLed || pinnedEvidence) && (
            <BookmarkTicket
              verified={pinnedEvidence}
              mark={room.bookmark}
              onLocate={() => article.onLocate(room.bookmark!)}
            />
          )}
          {personal && !started ? (
            <div className="gather-note window-welcome">
              <small>
                <Feather size={13} /> 呼噜猫把椅子挪近了一点
              </small>
              <p>来啦，坐会儿。今天过得怎么样？</p>
              <span>说自己的事也行，不用先带一篇文章。</span>
            </div>
          ) : !started && room?.bookmark ? null : !started && room && article ? (
            <div className="gather-note">
              <small>
                <Feather size={13} /> 看山抄下这一句
              </small>
              <p>
                {room.context.at(-1)?.contentText.trim().slice(0, 76) || room.context.at(-1)?.title}
              </p>
              <span>
                {room.context.at(-1)?.origin === "sample"
                  ? "本地试读，不会发送文章。"
                  : r || loading
                    ? "看山在整理这篇的材料。"
                    : "选文章导读时，才提交本轮摘录。"}
                也可以不聊文章。
              </span>
              <button className="paper-link" onClick={article.onPersonal}>
                不带文章，去窗边坐坐 →
              </button>
            </div>
          ) : (
            <>
              {line?.quoteRef && !pinnedEvidence && (
                <Evidence quote={line.quoteRef} onLocate={locateQuote(line.quoteRef)} />
              )}
              {line?.speaker === "shiba" && line.kind === "script" && r && (
                <Sources sources={r.curatedSources} />
              )}
              {count > 1 && (
                <div className="transcript">
                  <div className="transcript-head">
                    <strong>
                      <MessageSquare size={15} /> {showLog ? "聊天记录" : "刚才聊到"}
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
                    {(showLog ? turns : turns?.slice(0, -1).slice(-2))?.map((m) => (
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
              )}
            </>
          )}
          {article && room && !personal && (started || readerLed) && (
            <details className="context-details">
              <summary>本轮阅读与原帖 · {room.context.length}</summary>
              {readerLed && room.bookmark && !pinnedEvidence && (
                <BookmarkTicket
                  mark={room.bookmark}
                  onLocate={() => article.onLocate(room.bookmark!)}
                />
              )}
              {room.context.map((t) => (
                <a key={t.url} href={t.url} target="_blank" rel="noreferrer">
                  {t.title} ↗
                </a>
              ))}
              {r && (
                <p>
                  {r.radar.summaryTag}
                  {room.context.at(-1)?.origin !== "sample" &&
                    ` · 干货 ${r.radar.drynessScore} / 情绪 ${r.radar.anxietyScore} / 引流线索 ${r.radar.adRiskScore}`}
                </p>
              )}
              {!r && readerLed && (
                <button className="paper-link" onClick={article.onRetry} disabled={loading}>
                  {loading ? "正在整理原文…" : "单独整理这篇的资料 →"}
                </button>
              )}
              {r?.meta.degraded && <p>{r.meta.note || "本轮仅使用已取得的材料。"}</p>}
              {readerLed && cardAvailable && !cardOpen && (
                <button className="paper-link" onClick={() => setCardOpen(true)}>
                  查看这篇的掌控卡 →
                </button>
              )}
              <button className="paper-link" onClick={article.onPersonal}>
                不带文章，去窗边坐坐 →
              </button>
            </details>
          )}
          {article && cardOpen && room && cardAvailable && (
            <div ref={cardRef}>
              <ControlCard
                room={room}
                busy={article.choosing}
                onChoose={article.onChoose}
                onCommit={article.onCommit}
              />
            </div>
          )}
          {article && error && (!readerLed || cardOpen) && (
            <p className="room-error" role="status">
              {error} {room && !r && <button onClick={article.onRetry}>再试一次</button>}
            </p>
          )}
        </div>
        <footer className="room-footer">
          {!settled ? (
            <button className="room-continue" onClick={() => setSettled(true)}>
              跳过入场 <ArrowRight size={17} />
            </button>
          ) : (
            room && (
              <>
                {article && !readerLed && !started && (
                  <button
                    className="room-continue"
                    disabled={loading || !!draft.trim()}
                    onClick={article.onNext}
                  >
                    {loading ? "看山正在翻阅原帖…" : "开聊 · 听呼噜猫说"}
                    <ArrowRight size={17} />
                  </button>
                )}
                {article && !readerLed && started && !finished && (
                  <button
                    className="room-continue"
                    disabled={!!draft.trim()}
                    onClick={() => {
                      setShowLog(false);
                      article.onNext();
                      flow.current?.scrollTo({ top: 0 });
                    }}
                  >
                    听下一句{" "}
                    <small>
                      {room.cursor} / {r?.dialogues.length}
                    </small>
                    <ArrowRight size={15} />
                  </button>
                )}
                {!readerLed && finished && !cardOpen && (
                  <button className="room-continue" onClick={() => setCardOpen(true)}>
                    接过看山的掌控卡 <ArrowRight size={15} />
                  </button>
                )}
                {readerLed && (
                  <div className="reader-floor">
                    <i />
                    {started ? "话头留给你，不着急回。" : "窗边有位置，随时开口。"}
                  </div>
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
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={400}
                    onCompositionStart={() => {
                      composing.current = true;
                      onDraftStart?.();
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
                    onChange={(e) => {
                      onDraftStart?.();
                      setDraft(e.target.value);
                    }}
                    aria-label="我也说一句"
                    placeholder={started ? "我也说一句…" : "从你想说的那句开始…"}
                  />
                  <button disabled={!draft.trim()} aria-label="发送消息">
                    <ArrowUp size={18} />
                  </button>
                </form>
              </>
            )
          )}
        </footer>
      </div>
    </PaperDialog>
  );
}
