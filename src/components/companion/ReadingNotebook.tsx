"use client";
import { useState } from "react";
import { X, ExternalLink, Bell, BellOff, BookOpen } from "lucide-react";
import { art } from "@/lib/art";
import { PaperDialog } from "./PaperDialog";
import type { ReadingTrailItem } from "@/types";
import type { Book } from "@/lib/companion";
export const dateLabel = (n: number) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(n);
export function ReadingNotebook({
  history,
  book,
  onOpen,
  onResume,
  onClose,
  onToggle,
  onClear,
  temporary,
}: {
  history: ReadingTrailItem[];
  book: Book;
  onOpen: (item: ReadingTrailItem) => void;
  onResume: (key: string) => void;
  onClose: () => void;
  onToggle: () => void;
  onClear: () => void;
  temporary: boolean;
}) {
  const [sure, setSure] = useState(false),
    [tab, setTab] = useState<"reading" | "conversations">("reading");
  const chats = book.threads.filter((t) => t.turns.length).sort((a, z) => z.touched - a.touched);
  return (
    <PaperDialog className="shelf-dialog" label="阅读记录与聊天" onClose={onClose}>
      <div className="shelf-content">
        <header className="sheet-header">
          <div>
            <div className="kicker">MY READING SHELF</div>
            <h2>看山的摘记本</h2>
          </div>
          <button className="icon-b" onClick={onClose} aria-label="关闭记录">
            <X size={18} />
          </button>
        </header>
        <div className="shelf-tabs">
          <button aria-pressed={tab === "reading"} onClick={() => setTab("reading")}>
            阅读记录 <b>{history.length}</b>
          </button>
          <button aria-pressed={tab === "conversations"} onClick={() => setTab("conversations")}>
            过去的聊天 <b>{chats.length}</b>
          </button>
        </div>
        <div className="shelf-list">
          <p className="muted">
            {tab === "reading"
              ? "展开全文或在正文停留 2.5 秒后记下。保留最近 100 篇；默认带最近 5 篇进圆桌。"
              : "每篇的对话单独收好。点开可从上次停下的位置继续，最近 16 间小屋各留 72 条发言。"}
          </p>
          {tab === "reading"
            ? [...history].reverse().map((t) => (
                <article className="shelf-row" key={t.url}>
                  <small>
                    <BookOpen size={12} /> {t.origin === "sample" ? "本地试读 · " : ""}
                    {dateLabel(t.readAt)} · 读过 {t.visits ?? 1} 次
                  </small>
                  <h3>{t.title}</h3>
                  <p>@{t.author}</p>
                  <div>
                    <a href={t.url} target="_blank" rel="noreferrer">
                      {t.origin === "sample" ? "重读试读原文" : "重读原帖"}{" "}
                      <ExternalLink size={12} />
                    </a>
                    <button onClick={() => onOpen(t)}>和它们聊这篇 →</button>
                  </div>
                </article>
              ))
            : chats.map((t) => (
                <article className="shelf-row" key={t.key}>
                  <small>
                    {dateLabel(t.touched)} · {t.turns.length} 条发言
                  </small>
                  <h3>{t.title}</h3>
                  <button onClick={() => onResume(t.key)}>继续这段聊天 →</button>
                </article>
              ))}
          {(tab === "reading" ? !history.length : !chats.length) && (
            <div className="shelf-empty">
              <img src={art.sleeping} alt="呼噜猫正在打盹" />
              <p>
                {tab === "reading"
                  ? "书签还空着。翻开一个问题，读过的回答会出现在这里。"
                  : "还没有聊过。点窗沿上的看山，就能一起开桌。"}
              </p>
            </div>
          )}
        </div>
        <footer className="shelf-foot">
          <div className="note-pref">
            {book.enabled ? <Bell size={17} /> : <BellOff size={17} />}
            <div>
              <strong>呼噜猫的主动便签</strong>
              <small>聊过才来；至少等 5 分钟，24 小时最多一张。</small>
            </div>
            <button
              role="switch"
              aria-label="允许呼噜猫主动留便签"
              aria-checked={book.enabled}
              onClick={onToggle}
            >
              <i />
            </button>
          </div>
          <div className="privacy-row">
            <span>
              {temporary
                ? "浏览器未能保存，仅本页有效。"
                : "聊天和便签存在本机。开真实圆桌时才提交本轮已读摘录。"}
            </span>
            {!sure ? (
              <button onClick={() => setSure(true)}>清空记录</button>
            ) : (
              <span>
                <button
                  onClick={() => {
                    onClear();
                    setSure(false);
                  }}
                >
                  确认清空阅读和聊天
                </button>{" "}
                · <button onClick={() => setSure(false)}>取消</button>
              </span>
            )}
          </div>
          <small>清空不会删除已拍板的手账。</small>
        </footer>
      </div>
    </PaperDialog>
  );
}
