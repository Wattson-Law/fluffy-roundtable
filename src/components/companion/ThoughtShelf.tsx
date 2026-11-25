"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Room } from "../../lib/companion";
import {
  lastReaderWords,
  MAX_THOUGHT_LENGTH,
  MAX_THOUGHTS,
  thoughtSourceUrl,
  thoughtText,
  validateReaderThoughts,
  type ReaderThought,
} from "../../lib/reader-thoughts.ts";
import type { ReadingTrailItem } from "../../types";
import styles from "./ThoughtShelf.module.css";

type WriterProps = {
  room: Pick<Room, "key" | "turns">;
  /** Offer the identified article at this table, never the most recent item on the bookshelf. */
  source?: Pick<ReadingTrailItem, "title" | "url"> | null;
  onEditingChange?: (editing: boolean) => void;
  /** Synchronous local Book update. Return false if not accepted; the draft stays here. */
  onSave: (thought: ReaderThought) => boolean;
};
type ShelfActions = {
  /** Only the saved line and its optional link; opening a preview does not call this. */
  onDiscuss: (thought: ReaderThought) => void;
  onRemove: (id: string) => void;
};
export type ThoughtShelfProps = { thoughts?: readonly ReaderThought[] } & (
  | ({ mode: "cabin" } & WriterProps)
  | ({ mode: "shelf" } & ShelfActions)
);

function ThoughtWriter({
  room,
  source,
  onSave,
  full,
  onEditingChange,
}: WriterProps & { full: boolean }) {
  const id = useId();
  const opener = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) return;
    onEditingChange?.(true);
    return () => onEditingChange?.(false);
  }, [editing, onEditingChange]);
  const [draft, setDraft] = useState("");
  const [attached, setAttached] = useState<string>();
  const [notice, setNotice] = useState("");
  const line = thoughtText(draft),
    length = [...draft.trim()].length;
  const url = thoughtSourceUrl(source?.url);

  function close(message: string) {
    setEditing(false);
    setDraft("");
    setAttached(undefined);
    setNotice(message);
    opener.current?.focus();
  }
  function save() {
    if (full || !line) return;
    const now = Date.now();
    const thought: ReaderThought = {
      id:
        globalThis.crypto?.randomUUID?.() ??
        `${now.toString(36)}-${Math.random().toString(36).slice(2)}`,
      text: line,
      createdAt: now,
      ...(url && attached === url ? { sourceUrl: url } : {}),
    };
    if (onSave(thought)) close("念头已放进书架。");
    else setNotice("这次没存下，草稿还在。请检查书架是否已满。");
  }
  function useOwnWords() {
    const words = lastReaderWords(room.turns);
    if (!words) {
      setNotice("这桌还没有能直接用的一行短原话。可以自己写个念头。");
      return;
    }
    setDraft(words);
    setNotice("这是你上一句原话。看一眼，想留下再点保存。");
    input.current?.focus();
  }
  return (
    <section className={styles.panel} aria-labelledby={`${id}-heading`}>
      <div className={styles.bar}>
        <h3 id={`${id}-heading`}>上次想到这儿</h3>
        <button
          type="button"
          ref={opener}
          aria-expanded={editing}
          aria-controls={editing ? `${id}-editor` : undefined}
          onClick={() => {
            if (editing) return close("");
            setNotice("");
            setEditing(true);
          }}
        >
          {editing ? "取消，不保存" : "记个念头"}
        </button>
      </div>
      {editing && (
        <div id={`${id}-editor`} className={styles.editor}>
          <label htmlFor={`${id}-line`}>念头或短标题</label>
          <input
            id={`${id}-line`}
            ref={input}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={draft}
            placeholder="写下一句想留下的话"
            aria-describedby={`${id}-hint ${id}-length`}
            aria-invalid={length > 0 && !line}
            onChange={(e) => {
              setDraft(e.target.value);
              setNotice("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) e.preventDefault();
            }}
          />
          <small id={`${id}-hint`}>草稿只在这里。点保存才进书架，不会发给伙伴。</small>
          <small id={`${id}-length`}>
            {length} / {MAX_THOUGHT_LENGTH} 字
            {length > 0 && !line ? " · 请缩短为一行可读文字。" : ""}
          </small>
          {url && source && (
            <label className={styles.attachment}>
              <input
                type="checkbox"
                checked={attached === url}
                onChange={(e) => setAttached(e.target.checked ? url : undefined)}
              />
              附上这篇原文的链接：{source.title}
            </label>
          )}
          <div className={styles.actions}>
            <button type="button" onClick={useOwnWords} disabled={!!draft}>
              用上一句自己的话
            </button>
            <button type="button" className={styles.save} disabled={!line || full} onClick={save}>
              保存念头
            </button>
          </div>
          {full && (
            <p role="status">书架已满（{MAX_THOUGHTS} 条），请先去书架删一条。旧念头不会被顶掉。</p>
          )}
        </div>
      )}
      <p className={styles.notice} role="status">
        {notice}
      </p>
    </section>
  );
}

function ThoughtActions({
  thought,
  onDiscuss,
  onRemove,
}: ShelfActions & { thought: ReaderThought }) {
  const hint = useId(),
    removeButton = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <div className={styles.actions}>
        {thought.sourceUrl && (
          <a href={thought.sourceUrl} target="_blank" rel="noopener noreferrer">
            {thought.sourceUrl.startsWith("/") ? "回看本地试读" : "回看知乎原文"}（新窗口）
          </a>
        )}
        <button type="button" onClick={() => onDiscuss(thought)}>
          继续聊这个念头
        </button>
        <button
          type="button"
          ref={removeButton}
          aria-describedby={confirming ? hint : undefined}
          onClick={() => (confirming ? onRemove(thought.id) : setConfirming(true))}
        >
          {confirming ? "确认删除" : "删除这个念头"}
        </button>
        {confirming && (
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              removeButton.current?.focus();
            }}
          >
            取消删除
          </button>
        )}
      </div>
      {confirming && (
        <p id={hint} role="status">
          只从书架删除这个念头，不会删除聊天或原文。
        </p>
      )}
    </>
  );
}

function SavedThoughts({ list, onDiscuss, onRemove }: ShelfActions & { list: ReaderThought[] }) {
  const id = useId(),
    heading = useRef<HTMLHeadingElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  function remove(thoughtId: string) {
    onRemove(thoughtId);
    setOpenId(null);
    heading.current?.focus();
  }
  return (
    <section className={styles.panel} aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`} ref={heading} tabIndex={-1}>
        上次想到这儿
      </h3>
      {!list.length && <p>还没有存下念头。在小屋里想留一句时再记就好。</p>}
      <ul className={styles.list}>
        {list.map((thought) => {
          const open = thought.id === openId,
            detailId = `${id}-${thought.id}-detail`;
          return (
            <li key={thought.id}>
              <button
                type="button"
                className={styles.preview}
                aria-expanded={open}
                aria-controls={open ? detailId : undefined}
                onClick={() => setOpenId(open ? null : thought.id)}
              >
                <span className={open ? styles.fullLine : styles.oneLine}>{thought.text}</span>
                <span aria-hidden="true">{open ? "−" : "＋"}</span>
              </button>
              {open && (
                <div id={detailId} className={styles.detail}>
                  <ThoughtActions thought={thought} onDiscuss={onDiscuss} onRemove={remove} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Mount inside the client-side cabin (outside its chat form) or the notebook. No storage or transport here. */
export function ThoughtShelf(props: ThoughtShelfProps) {
  const list = validateReaderThoughts(props.thoughts);
  return props.mode === "cabin" ? (
    <ThoughtWriter key={props.room.key} {...props} full={list.length >= MAX_THOUGHTS} />
  ) : (
    <SavedThoughts {...props} list={list} />
  );
}
