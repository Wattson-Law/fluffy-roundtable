"use client";

import { useCallback, useEffect, useState } from "react";
import { CabinModal } from "@/components/cabin/CabinModal";
import { KanshanDock } from "@/components/companion/KanshanDock";
import { CatJournalDrawer } from "@/components/journal/CatJournalDrawer";
import { HotFeedList } from "@/components/zhihu-sim/HotFeedList";
import { QuestionDetail } from "@/components/zhihu-sim/QuestionDetail";
import { SectionTitle, TopSearchBar } from "@/components/zhihu-sim/TopSearchBar";
import { addJournal, getJournal, getTrail, pushTrail } from "@/lib/storage";
import type {
  HotItem,
  JournalEntry,
  ReadingTrailItem,
  RoundtableResult,
  ZhihuItem,
} from "@/types";

type View = { kind: "hot" } | { kind: "detail"; title: string };

export default function Home() {
  /* ---------- 模拟知乎区 ---------- */
  const [hot, setHot] = useState<HotItem[]>([]);
  const [hotLoading, setHotLoading] = useState(true);
  const [view, setView] = useState<View>({ kind: "hot" });
  const [answers, setAnswers] = useState<ZhihuItem[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersReason, setAnswersReason] = useState<string | undefined>();
  const [quota, setQuota] = useState<{ live: boolean; note: string }>({
    live: false,
    note: "额度检测中…",
  });

  /* ---------- 陪伴与小屋 ---------- */
  const [trail, setTrail] = useState<ReadingTrailItem[]>([]);
  const [cabinOpen, setCabinOpen] = useState(false);
  const [result, setResult] = useState<RoundtableResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);

  /* ---------- 手账 ---------- */
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [journalOpen, setJournalOpen] = useState(false);

  /* ---------- 初始化 ---------- */
  useEffect(() => {
    setTrail(getTrail());
    setJournal(getJournal());

    void fetch("/api/zhihu/hot?limit=30")
      .then((r) => r.json())
      .then((j) => setHot(j.items ?? []))
      .catch(() => setHot([]))
      .finally(() => setHotLoading(false));

    void fetch("/api/zhihu/quota")
      .then((r) => r.json())
      .then((j) => setQuota({ live: Boolean(j.live), note: j.note ?? "" }))
      .catch(() => setQuota({ live: false, note: "额度未知" }));
  }, []);

  /* ---------- 打开问题：拉取真实回答 ---------- */
  const openQuestion = useCallback(async (title: string) => {
    setView({ kind: "detail", title });
    setAnswers([]);
    setAnswersReason(undefined);
    setAnswersLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const res = await fetch(`/api/zhihu/search?q=${encodeURIComponent(title)}&count=10`);
      const j = await res.json();
      setAnswers(j.items ?? []);
      if (j.degraded) setAnswersReason(j.reason);
    } catch (e) {
      setAnswersReason((e as Error).message);
    } finally {
      setAnswersLoading(false);
    }
  }, []);

  /* ---------- 静默记录浏览轨迹 ---------- */
  const handleRead = useCallback(
    (item: ZhihuItem) => {
      const from = view.kind === "detail" ? view.title : undefined;
      setTrail(pushTrail(item, from));
    },
    [view],
  );

  /* ---------- 开圆桌会 ---------- */
  const runAnalyze = useCallback(async () => {
    const current = getTrail();
    if (current.length === 0) {
      setError("还没看过帖子呢，先去刷两篇再叫我们开会吧～");
      setResult(null);
      return;
    }
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setCommitted(false);
    try {
      const res = await fetch("/api/roundtable/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trail: current,
          topicHint: view.kind === "detail" ? view.title : current.at(-1)?.fromQuestion,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.message ?? "圆桌暂时开不起来，稍后再试试。");
        return;
      }
      setResult(j as RoundtableResult);
    } catch (e) {
      setError(`网络有点抖：${(e as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  }, [view]);

  const openCabin = useCallback(() => {
    setCabinOpen(true);
    setTrail(getTrail());
    if (!result && !analyzing) void runAnalyze();
  }, [result, analyzing, runAnalyze]);

  /* ---------- 拍板入账 ---------- */
  const commit = useCallback(() => {
    if (!result) return;
    setJournal(
      addJournal({
        topicTitle: result.topicTitle,
        oneLineTakeaway: result.controlCard.oneLineTakeaway,
        microAction: result.controlCard.microAction,
        catBadgeTheme: result.controlCard.catBadgeTheme,
        catBadgeName: result.controlCard.catBadgeName,
        sources: result.curatedSources.map((s) => ({
          title: s.title,
          author: s.author,
          url: s.url,
        })),
      }),
    );
    setCommitted(true);
  }, [result]);

  const recordedUrls = new Set(trail.map((t) => t.url));

  return (
    <div className="min-h-screen">
      <TopSearchBar
        onSearch={openQuestion}
        onHome={() => setView({ kind: "hot" })}
        onJournal={() => setJournalOpen(true)}
        journalCount={journal.length}
        quotaNote={quota.note}
        quotaLive={quota.live}
      />

      <main className="mx-auto max-w-[840px] px-4 py-4 pb-28">
        {view.kind === "hot" ? (
          <>
            <SectionTitle
              text="知乎热榜"
              sub="真实实时数据 · 点进任意问题就能看真回答"
            />
            <HotFeedList
              items={hot}
              loading={hotLoading}
              onOpen={(it) => void openQuestion(it.title)}
            />
          </>
        ) : (
          <QuestionDetail
            title={view.title}
            items={answers}
            loading={answersLoading}
            recordedUrls={recordedUrls}
            onBack={() => setView({ kind: "hot" })}
            onRead={handleRead}
            degradedReason={answersReason}
          />
        )}
      </main>

      <KanshanDock count={trail.length} onOpen={openCabin} busy={analyzing} />

      <CabinModal
        open={cabinOpen}
        onClose={() => setCabinOpen(false)}
        trail={trail}
        result={result}
        loading={analyzing}
        error={error}
        onCommit={commit}
        committed={committed}
        onRetry={() => void runAnalyze()}
      />

      <CatJournalDrawer
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
        entries={journal}
      />
    </div>
  );
}
