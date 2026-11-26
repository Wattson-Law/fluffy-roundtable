"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, MessageSquare, ShieldCheck } from "lucide-react";
import { SelectablePassage } from "./SelectablePassage";
import type { PassageBookmark, ZhihuItem } from "@/types";

/**
 * 单篇回答卡片
 * 静默记录触发条件（§3.3-2）：展开全文 或 在视口停留 >= 2.5 秒
 */
export function AnswerCard({
  item,
  index,
  questionTitle,
  recorded,
  onRead,
  onClip,
}: {
  item: ZhihuItem;
  index: number;
  questionTitle?: string;
  recorded: boolean;
  onRead: (item: ZhihuItem) => void;
  onClip: (item: ZhihuItem, mark: PassageBookmark) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [failedAvatar, setFailedAvatar] = useState<string>();
  const toggle = () => {
    if (!expanded) onRead(item);
    setExpanded(!expanded);
  };

  const long = item.contentText.length > 220;

  return (
    <article
      data-read-index={index}
      data-recorded={recorded}
      className={`answer-paper zh-card rounded-lg p-4 transition ${
        recorded ? "shadow-[0_0_0_1px_rgba(217,196,150,0.38)]" : ""
      }`}
    >
      {/* 作者行 */}
      <div className="mb-2 flex items-center gap-2">
        {item.authorAvatar && item.authorAvatar !== failedAvatar ? (
          <img
            src={item.authorAvatar}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setFailedAvatar(item.authorAvatar)}
            className="h-7 w-7 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span aria-hidden="true" className="author-seal">{item.author.trim().slice(0, 1) || "读"}</span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-zh-text">{item.author}</span>
            {item.authoritylevel >= 3 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[#eaf1ef] px-1 py-0.5 text-[10px] text-[#355e58]">
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
          <span className="shrink-0 rounded-full bg-[#f6ebd0] px-2 py-0.5 text-[10px] text-[#7c5a26]">
            看山已记下
          </span>
        )}
      </div>

      {item.title && item.title !== questionTitle && index >= 0 && (
        <h3 className="mb-1.5 text-[14.5px] font-semibold leading-snug text-zh-text">
          {item.title}
        </h3>
      )}

      {/* 真实回答正文 */}
      <SelectablePassage
        item={item}
        clamped={long && !expanded}
        onExpand={() => {
          setExpanded(true);
          onRead(item);
        }}
        onClip={(m) => {
          onRead(item);
          onClip(item, m);
        }}
      />

      {long && (
        <button
          onClick={toggle}
          className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-zh-blue"
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
        {!item.origin && (
          <>
            <span className="zh-vote rounded-full px-2.5 py-1 font-medium">
              ▲ 赞同 {item.voteUpCount.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={12} />
              {item.commentCount}
            </span>
          </>
        )}
        <a
          href={item.url}
          onClick={() => onRead(item)}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 hover:text-zh-blue"
        >
          <ExternalLink size={12} />
          {item.origin ? "打开试读原文" : "查看原帖"}
        </a>
      </div>
    </article>
  );
}
