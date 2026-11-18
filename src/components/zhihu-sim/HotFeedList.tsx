"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { HotItem } from "@/types";

const TAG_STYLE: Record<string, string> = {
  人生选择: "bg-amber-50 text-amber-700 border-amber-200",
  科技: "bg-sky-50 text-sky-700 border-sky-200",
  情感: "bg-rose-50 text-rose-700 border-rose-200",
  热点: "bg-slate-100 text-slate-600 border-slate-200",
};

/** 实时热榜卡片流 */
export function HotFeedList({
  items,
  loading,
  onOpen,
}: {
  items: HotItem[];
  loading: boolean;
  onOpen: (item: HotItem) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-[13px] text-zh-sub">
        <Loader2 size={14} className="animate-spin" />
        正在拉取真实知乎热榜…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="zh-card rounded-lg p-8 text-center text-[13px] text-zh-sub">
        热榜暂时拉不到，试试上面的搜索框直接搜一个你正纠结的问题。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <motion.button
          key={it.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.025, 0.4) }}
          onClick={() => onOpen(it)}
          className="zh-card zh-card-hover block w-full rounded-lg p-3.5 text-left transition"
        >
          <div className="flex gap-3">
            <span
              className={`mt-0.5 shrink-0 text-[15px] font-bold tabular-nums ${
                i < 3 ? "text-[#FF6B35]" : "text-zh-sub"
              }`}
            >
              {i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-zh-text">
                  {it.title}
                </h3>
                {it.tag && (
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                      TAG_STYLE[it.tag] ?? "bg-zh-bg text-zh-sub border-zh-line"
                    }`}
                  >
                    {it.tag}
                  </span>
                )}
              </div>
              {it.summary && (
                <p className="zh-clamp-4 mt-1 text-[12.5px] leading-relaxed text-zh-sub">
                  {it.summary}
                </p>
              )}
            </div>

            {it.thumbnailUrl && (
              // 知乎 CDN 防盗链：必须 no-referrer，裂图时隐藏
              <img
                src={it.thumbnailUrl}
                alt=""
                referrerPolicy="no-referrer"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
                className="h-16 w-24 shrink-0 rounded object-cover"
              />
            )}
          </div>
        </motion.button>
      ))}
    </div>
  );
}
