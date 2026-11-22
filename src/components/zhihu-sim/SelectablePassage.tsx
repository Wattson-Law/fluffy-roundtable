"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Bookmark, ArrowRight } from "lucide-react";
import { clipPassage, MAX_QUOTE, sentenceChoices } from "@/lib/bookmarks";
import type { PassageBookmark, ZhihuItem } from "@/types";

export function SelectablePassage({
  item,
  clamped,
  onExpand,
  onClip,
}: {
  item: ZhihuItem;
  clamped: boolean;
  onExpand: () => void;
  onClip: (m: PassageBookmark) => void;
}) {
  const text = useRef<HTMLDivElement>(null),
    controls = useRef<HTMLDivElement>(null),
    id = useId();
  const [selected, setSelected] = useState<PassageBookmark | null>(null),
    [tooLong, setTooLong] = useState(false);
  const [picker, setPicker] = useState(false),
    [page, setPage] = useState(0);
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null);
  const [choice, setChoice] = useState<PassageBookmark | null>(null);
  const choices = useMemo(
    () => (picker ? sentenceChoices(item.contentText) : []),
    [picker, item.contentText],
  );
  const perPage = 5,
    mark = choice ?? selected;
  useEffect(() => {
    function inspect() {
      const s = window.getSelection(),
        el = text.current;
      if (!el || !s || s.rangeCount !== 1 || s.isCollapsed) {
        // A keyboard or touch click can collapse the native range while its action is focused.
        if (!controls.current?.contains(document.activeElement)) {
          setSelected(null);
          setTooLong(false);
        }
        return;
      }
      const r = s.getRangeAt(0);
      if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) {
        setSelected(null);
        setTooLong(false);
        return;
      }
      const prefix = r.cloneRange();
      prefix.selectNodeContents(el);
      prefix.setEnd(r.startContainer, r.startOffset);
      const start = prefix.toString().length,
        raw = r.toString();
      const cut = clipPassage(item, start, start + raw.length);
      setChoice(null);
      setSelected(cut);
      setTooLong(!cut && [...raw.trim()].length > MAX_QUOTE);
      const rect = [...r.getClientRects()]
        .reverse()
        .find((x) => x.height > 0 && x.bottom > 0 && x.top < innerHeight);
      setSpot(
        rect
          ? {
              left: Math.max(8, Math.min(rect.left, innerWidth - 274)),
              top: Math.max(8, rect.bottom + 56 <= innerHeight ? rect.bottom + 7 : rect.top - 51),
            }
          : null,
      );
    }
    const move = () => {
      if (text.current?.contains(window.getSelection()?.anchorNode ?? null)) inspect();
    };
    document.addEventListener("selectionchange", inspect);
    window.addEventListener("scroll", move, { passive: true });
    window.addEventListener("resize", move);
    return () => {
      document.removeEventListener("selectionchange", inspect);
      window.removeEventListener("scroll", move);
      window.removeEventListener("resize", move);
    };
  }, [item]);
  function take() {
    if (!mark) return;
    window.getSelection()?.removeAllRanges();
    setPicker(false);
    setSelected(null);
    setChoice(null);
    setTooLong(false);
    onClip(mark);
  }
  return (
    <>
      <div ref={text} data-passage-text className={`zh-prose ${clamped ? "zh-clamp-4" : ""}`}>
        {item.contentText}
      </div>
      {item.contentText.trim() && (
        <div className="sentence-tools" ref={controls}>
          <div className="sentence-toolbar">
            <button
              className="picker-toggle"
              aria-controls={id}
              aria-expanded={picker}
              onClick={() => {
                if (!picker) onExpand();
                setPicker(!picker);
                setPage(0);
                setChoice(null);
                setSelected(null);
                setTooLong(false);
              }}
            >
              <Bookmark size={14} />
              {picker ? "收起选句" : "逐句挑选"}
            </button>
            {!picker && !selected && !tooLong && <small>也可直接划选正文</small>}
          </div>
          {picker && (
            <div className="sentence-picker" id={id}>
              <p>想把哪一句带进小屋？</p>
              {choices.slice(page * perPage, (page + 1) * perPage).map((c) => (
                <button
                  key={c.start}
                  data-sentence
                  aria-pressed={choice?.start === c.start}
                  onClick={() => setChoice(clipPassage(item, c.start, c.end))}
                >
                  {c.text}
                </button>
              ))}
              {choices.length > perPage && (
                <div className="sentence-pages">
                  <button disabled={!page} onClick={() => setPage(page - 1)}>
                    前几句
                  </button>
                  <span>
                    {page + 1} / {Math.ceil(choices.length / perPage)}
                  </span>
                  <button
                    disabled={(page + 1) * perPage >= choices.length}
                    onClick={() => setPage(page + 1)}
                  >
                    后几句
                  </button>
                </div>
              )}
            </div>
          )}
          {tooLong && <small role="status">一张书签最多 {MAX_QUOTE} 字，再选短一点。</small>}
          {mark && (
            <div
              className={"clip-action" + (!choice && spot ? " floating" : "")}
              style={!choice && spot ? spot : undefined}
            >
              <q>{mark.excerpt}</q>
              <button onMouseDown={(e) => e.preventDefault()} onClick={take}>
                拿这句去圆桌 <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
