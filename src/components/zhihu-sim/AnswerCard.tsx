"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, MessageSquare, ShieldCheck } from "lucide-react";
import type { ZhihuItem } from "@/types";

/**
 * 单篇回答卡片
 * 静默记录触发条件（§3.3-2）：展开全文 或 在视口停留 >= 2.5 秒
 */
export function AnswerCard({
  item,
  index,
  recorded,
  onRead,
}: {
  item: ZhihuItem;
  index: number;
  recorded: boolean;
  onRead: (item: ZhihuItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const firedRef = useRef(false);

  // 视口停留 2.5s 自动记入轨迹
  useEffect(() => {
    const el = ref.current;
    if (!el || firedRef.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          timer = setTimeout(() => {
            if (!firedRef.current) {
              firedRef.current = true;
              onRead(item);
            }
          }, 2500);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.5, 1] },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [item, onRead]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !firedRef.current) {
      firedRef.current = true;
      onRead(item);
    }
  };

  const long = item.contentText.length > 220;

  return (
    <article
      ref={ref}
      className={`zh-card rounded-lg p-4 transition ${
        recorded ? "border-ember-400/70 shadow-[0_0_0_1px_rgba(255,210,122,0.35)]" : ""
      }`}
    >
      {/* 作者行 */}
      <div className="mb-2 flex items-center gap-2">
        {item.authorAvatar ? (
          <img
            src={item.authorAvatar}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                "data:image/svg+xml;utf8," +
                encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" rx="14" fill="#E3E8EF"/></svg>`,
                );
            }}
            className="h-7 w-7 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-zh-text">{item.author}</span>
            {item.authoritylevel >= 3 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-sky-50 px-1 py-0.5 text-[10px] text-sky-700">
                <ShieldCheck size={9} />
                Lv.{item.authoritylevel}
              </span>
            )}
          </div>
          {item.authorBadge && (
            <p className="truncate text-[11px] text-zh-sub">{item.authorBadge}</p>
          )}
        </div>

        {recorded && (
          <span className="shrink-0 rounded-full bg-ember-400/20 px-2 py-0.5 text-[10px] text-ember-600">
            🦊 已记下
          </span>
        )}
      </div>

      {item.title && index >= 0 && (
        <h3 className="mb-1.5 text-[14.5px] font-semibold leading-snug text-zh-text">
          {item.title}
        </h3>
      )}

      {/* 真实回答正文 */}
      <div className={`zh-prose ${expanded ? "" : "zh-clamp-4"}`}>{item.contentText}</div>

      {long && (
        <button
          onClick={toggle}
          className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-zh-blue"
        >
          {expanded ? (
            <>
              收起 <ChevronUp size={13} />
            </>
          ) : (
            <>
              阅读全文 <ChevronDown size={13} />
            </>
          )}
        </button>
      )}

      {/* 精选评论 */}
      {expanded && item.comments.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-md bg-zh-bg p-2.5">
          <p className="text-[11px] font-medium text-zh-sub">精选评论</p>
          {item.comments.slice(0, 3).map((c, i) => (
            <p key={i} className="text-[12.5px] leading-relaxed text-zh-text/80">
              · {c}
            </p>
          ))}
        </div>
      )}

      {/* 操作栏 */}
      <div className="mt-3 flex items-center gap-3 text-[12px] text-zh-sub">
        <span className="zh-vote rounded-full px-2.5 py-1 font-medium">
          ▲ 赞同 {item.voteUpCount.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={12} />
          {item.commentCount}
        </span>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 hover:text-zh-blue"
        >
          <ExternalLink size={12} />
          查看原帖
        </a>
      </div>
    </article>
  );
}
