"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useReadingTracker } from "./useReadingTracker";
import { AnswerCard } from "./AnswerCard";
import type { PassageBookmark, ZhihuItem } from "@/types";

/** 问题详情：真实回答阅读流 */
export function QuestionDetail({
  title,
  items,
  loading,
  recordedUrls,
  onBack,
  onRead,
  onClip,
  degradedReason,
  readerActive,
  sample = false,
}: {
  title: string;
  items: ZhihuItem[];
  loading: boolean;
  recordedUrls: Set<string>;
  onBack: () => void;
  onRead: (item: ZhihuItem) => void;
  onClip: (item: ZhihuItem, mark: PassageBookmark) => void;
  degradedReason?: string;
  readerActive: boolean;
  sample?: boolean;
}) {
  const { list, record } = useReadingTracker(items, readerActive && !loading, onRead);
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-zh-sub hover:text-zh-blue"
      >
        <ArrowLeft size={14} /> 返回热榜
      </button>

      <div className="zh-card mb-3 rounded-lg p-4">
        <h1 className="text-[19px] font-bold leading-snug text-zh-text">{title}</h1>
        <p className="mt-1.5 text-[12.5px] text-zh-sub">
          {loading
            ? "正在拉取真实回答…"
            : sample
              ? "本地试读 · 伴读编辑室原创，不是知乎回答"
              : `${items.length} 个来自知乎的真实回答`}
          <span className="ml-2 text-[#637659]">展开全文，或停留片刻，看山会夹一张书签。</span>
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-14 text-[13px] text-zh-sub">
          <Loader2 size={14} className="animate-spin" />
          正在从知乎开放平台拉取回答…
        </div>
      ) : items.length === 0 ? (
        <div className="zh-card rounded-lg p-8 text-center text-[13px] text-zh-sub">
          这个问题暂时没搜到回答{degradedReason ? `（${degradedReason}）` : ""}， 换个关键词试试。
        </div>
      ) : (
        <div className="space-y-2.5" ref={list}>
          {items.map((it, i) => (
            <AnswerCard
              key={it.id || it.url}
              item={it}
              index={i}
              recorded={recordedUrls.has(it.url)}
              onRead={record}
              onClip={onClip}
            />
          ))}
        </div>
      )}
    </div>
  );
}
