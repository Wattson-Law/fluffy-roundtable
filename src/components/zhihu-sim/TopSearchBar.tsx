"use client";
import { BookOpen, BookHeart, Search, History } from "lucide-react";
import { useState } from "react";
export function TopSearchBar({
  onSearch,
  onHome,
  onJournal,
  onHistory,
  journalCount,
  historyCount,
}: {
  onSearch: (q: string) => void;
  onHome: () => void;
  onJournal: () => void;
  onHistory: () => void;
  journalCount: number;
  historyCount: number;
}) {
  const [q, setQ] = useState("");
  return (
    <header className="reading-mast">
      <div>
        <button className="mast-brand" onClick={onHome} aria-label="看山伴读首页">
          <span>
            <BookOpen size={20} />
          </span>
          看山伴读
        </button>
        <form
          className="mast-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) onSearch(q.trim());
          }}
        >
          <Search size={15} />
          <input
            aria-label="搜索知乎问题"
            placeholder="搜一篇想读的问题"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit">搜索</button>
        </form>
        <nav aria-label="我的书架">
          <button onClick={onHistory} aria-label={`阅读记录（${historyCount}篇）`}>
            <History size={16} />
            阅读记录<span>{historyCount}</span>
          </button>
          <button onClick={onJournal} aria-label={`猫咖手账（${journalCount}张）`}>
            <BookHeart size={16} />
            猫咖手账
          </button>
        </nav>
      </div>
    </header>
  );
}
