"use client";

import { Search, Flame, BookHeart } from "lucide-react";
import { useState } from "react";

/** 顶部仿知乎极简导航 */
export function TopSearchBar({
  onSearch,
  onHome,
  onJournal,
  journalCount,
  quotaNote,
  quotaLive,
}: {
  onSearch: (q: string) => void;
  onHome: () => void;
  onJournal: () => void;
  journalCount: number;
  quotaNote: string;
  quotaLive: boolean;
}) {
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-zh-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4">
        <button
          onClick={onHome}
          className="flex shrink-0 items-center gap-1.5 text-[17px] font-bold text-zh-blue"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-zh-blue text-[13px] text-white">
            知
          </span>
          <span className="hidden sm:inline">知乎</span>
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) onSearch(q.trim());
          }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-zh-bg px-3.5 py-2"
        >
          <Search size={14} className="shrink-0 text-zh-sub" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索你正在纠结的问题…"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-zh-sub"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-zh-blue px-3.5 py-1 text-[12.5px] font-medium text-white"
          >
            搜索
          </button>
        </form>

        <div
          title={quotaNote}
          className="hidden items-center gap-1.5 rounded-full border border-zh-line px-2.5 py-1 text-[11px] text-zh-sub lg:flex"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${quotaLive ? "bg-emerald-500" : "bg-amber-500"}`}
          />
          <span className="max-w-[260px] truncate">{quotaNote}</span>
        </div>

        <button
          onClick={onJournal}
          className="flex shrink-0 items-center gap-1 rounded-full border border-zh-line px-2.5 py-1.5 text-[12px] text-zh-sub hover:border-zh-blue hover:text-zh-blue"
        >
          <BookHeart size={13} />
          <span className="hidden sm:inline">猫咖手账</span>
          {journalCount > 0 && (
            <span className="rounded-full bg-ember-500 px-1.5 text-[10px] text-white">
              {journalCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

export function SectionTitle({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2">
      <Flame size={14} className="text-ember-600" />
      <h2 className="text-[15px] font-semibold text-zh-text">{text}</h2>
      {sub && <span className="text-[11.5px] text-zh-sub">{sub}</span>}
    </div>
  );
}
