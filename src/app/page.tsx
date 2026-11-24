"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { ArrowUpRight, BookOpen, Bookmark, Feather, Library } from "lucide-react";
import { CabinModal } from "@/components/cabin/CabinModal";
import { KanshanDock } from "@/components/companion/KanshanDock";
import { PartnerGuide } from "@/components/companion/PartnerGuide";
import { ReadingNotebook } from "@/components/companion/ReadingNotebook";
import { useCatDelivery } from "@/components/companion/useCatDelivery";
import { CatJournalDrawer } from "@/components/journal/CatJournalDrawer";
import { HotFeedList } from "@/components/zhihu-sim/HotFeedList";
import { QuestionDetail } from "@/components/zhihu-sim/QuestionDetail";
import { TopSearchBar } from "@/components/zhihu-sim/TopSearchBar";
import {
  addJournal,
  clearCompanion,
  getBook,
  getHistory,
  getJournal,
  getTrail,
  memoryOnly,
  pushTrail,
  rememberSeat,
  seatedRoom,
  STORAGE_KEYS,
  STORE_EVENT,
  updateBook,
} from "@/lib/storage";
import {
  acceptChoice,
  changeRoom,
  dismissNote,
  takeNote,
  PERSONAL_ROOM,
  duties,
  emptyBook,
  names,
  nextLine,
  say,
  setNotes,
  startThread,
  withResult,
  type Book,
  type Room,
} from "@/lib/companion";
import { bookmarkKey, requestFocus } from "@/lib/bookmarks";
import { focusRound } from "@/lib/focused-round";
import { PassageDialog } from "@/components/companion/PassageBookmark";
import { art } from "@/lib/art";
import { sampleItems, sampleRound } from "@/lib/reading-samples";
import type {
  HotItem,
  JournalEntry,
  PassageBookmark,
  ReadingTrailItem,
  RoundtableResult,
  Speaker,
  ZhihuItem,
} from "@/types";

type Overlay = "cabin" | "shelf" | "journal" | "friends" | null;
export default function Home() {
  const [viewing, setViewing] = useState<PassageBookmark | null>(null);
  const [partner, setPartner] = useState<Speaker>("purr_cat");
  function meet(s: Speaker) {
    setPartner(s);
    setOverlay("friends");
  }
  const [hot, setHot] = useState<HotItem[]>([]),
    [hotLoading, setHotLoading] = useState(true),
    [live, setLive] = useState(false);
  const [quotaNote, setQuotaNote] = useState("");
  const [sample, setSample] = useState(false);
  const [question, setQuestion] = useState<string | null>(null),
    [answers, setAnswers] = useState<ZhihuItem[]>([]),
    [answersLoading, setAnswersLoading] = useState(false),
    [reason, setReason] = useState<string>();
  const [history, setHistory] = useState<ReadingTrailItem[]>([]),
    [journal, setJournal] = useState<JournalEntry[]>([]),
    [book, setBook] = useState<Book>(emptyBook),
    [temporary, setTemporary] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null),
    [key, setKey] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [choosing, setChoosing] = useState(false),
    [folding, setFolding] = useState(false),
    [error, setError] = useState<string | null>(null),
    [drafts, setDrafts] = useState<Record<string, string>>({});
  const answerReq = useRef<AbortController | null>(null),
    reportReq = useRef<AbortController | null>(null),
    choiceReq = useRef<AbortController | null>(null),
    guideOpening = useRef<AbortController | null>(null);
  const room = book.threads.find((t) => t.key === key);
  const draft = key ? (drafts[key] ?? "") : "";
  useEffect(() => {
    const entry = sampleItems.find(
      (s) => s.id === new URLSearchParams(window.location.search).get("sample"),
    );
    if (entry) {
      setQuestion(entry.title);
      setAnswers([entry]);
      setSample(true);
    }
    function sync() {
      setHistory(getHistory());
      setJournal(getJournal());
      setBook(getBook());
      setTemporary(memoryOnly());
    }
    function storage(e: StorageEvent) {
      if (!e.key || STORAGE_KEYS.includes(e.key)) sync();
    }
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", storage);
    const c = new AbortController();
    void fetch("/api/zhihu/quota", { signal: c.signal })
      .then((r) => r.json())
      .then((j) => {
        if (!c.signal.aborted && j.live) setQuotaNote(j.note ?? "");
      })
      .catch(() => {});
    void fetch("/api/zhihu/hot?limit=30", { signal: c.signal })
      .then((r) => r.json())
      .then((j) => {
        setHot(j.items ?? []);
        setLive(!j.degraded && !!j.items?.length);
      })
      .catch(() => {})
      .finally(() => {
        if (!c.signal.aborted) setHotLoading(false);
      });
    return () => {
      c.abort();
      answerReq.current?.abort();
      reportReq.current?.abort();
      choiceReq.current?.abort();
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", storage);
    };
  }, []);
  useCatDelivery({
    activeKey: overlay === "cabin" ? key : null,
    busy:
      !!viewing ||
      overlay === "friends" ||
      overlay === "shelf" ||
      overlay === "journal" ||
      (overlay === "cabin" && (!room?.turns.length || loading || choosing || folding)) ||
      Object.values(drafts).some((v) => !!v.trim()),
  });
  useEffect(() => {
    if (overlay === "cabin" && key && book.pending?.key === key)
      updateBook((b) => (b.pending?.key === key ? dismissNote(b) : b));
  }, [overlay, key, book.pending?.key]);
  const openQuestion = useCallback(async (title: string) => {
    answerReq.current?.abort();
    const c = new AbortController();
    answerReq.current = c;
    setSample(false);
    setQuestion(title);
    setAnswers([]);
    setReason(undefined);
    setAnswersLoading(true);
    window.scrollTo({ top: 0 });
    try {
      const res = await fetch(`/api/zhihu/search?q=${encodeURIComponent(title)}&count=10`, {
        signal: c.signal,
      });
      const j = await res.json();
      if (c.signal.aborted) return;
      setAnswers(j.items ?? []);
      if (!res.ok || j.degraded) setReason("检索暂时没有返回内容");
    } catch {
      if (!c.signal.aborted) setReason("连接暂时中断");
    } finally {
      if (!c.signal.aborted) setAnswersLoading(false);
    }
  }, []);
  const home = () => {
    answerReq.current?.abort();
    setSample(false);
    setQuestion(null);
    if (location.search) window.history.replaceState(null, "", location.pathname);
    window.scrollTo({ top: 0 });
  };
  function openSample(item: ZhihuItem) {
    answerReq.current?.abort();
    setQuestion(item.title);
    setSample(true);
    setAnswers([item]);
    setReason(undefined);
    setAnswersLoading(false);
    window.scrollTo({ top: 0 });
  }
  const read = useCallback(
    (item: ZhihuItem) => {
      pushTrail(item, question ?? undefined);
    },
    [question],
  );
  function stopChoice() {
    choiceReq.current?.abort();
    setChoosing(false);
  }
  function giveFloorToReader() {
    stopChoice();
    // The article may finish loading, but typing retires its requested opening line.
    guideOpening.current = null;
  }
  function cancelRoomRequests() {
    reportReq.current?.abort();
    stopChoice();
    setLoading(false);
  }
  function close() {
    cancelRoomRequests();
    setOverlay(null);
    setError(null);
    if (overlay === "cabin")
      requestAnimationFrame(() => {
        if (document.activeElement === document.body)
          document.querySelector<HTMLButtonElement>(".window-pet")?.focus({ preventScroll: true });
      });
  }
  async function analyze(t: Room, openGuide = false) {
    if (t.context.at(-1)?.origin === "sample") {
      const result = sampleRound(t.context);
      updateBook((b) => {
        const prepared = withResult(
          b,
          t.key,
          t.bookmark ? focusRound(result, t.context[0], t.bookmark.excerpt) : result,
        );
        return openGuide ? nextLine(prepared, t.key, Date.now()) : prepared;
      });
      return;
    }
    reportReq.current?.abort();
    const c = new AbortController();
    reportReq.current = c;
    guideOpening.current = openGuide ? c : null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/roundtable/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: c.signal,
        body: JSON.stringify({
          trail: t.context.map(
            ({ id, url, title, author, comments, authoritylevel, voteUpCount, contentText }) => ({
              id,
              url,
              title,
              author,
              comments,
              authoritylevel,
              voteUpCount,
              contentText,
            }),
          ),
          topicHint: t.title,
          ...(t.bookmark ? { focus: requestFocus(t.bookmark) } : {}),
        }),
      });
      const data = await res.json();
      if (c.signal.aborted) return;
      if (!res.ok || !Array.isArray(data.dialogues) || !data.dialogues.length) throw Error();
      updateBook((b) => {
        const prepared = withResult(b, t.key, data as RoundtableResult);
        return guideOpening.current === c ? nextLine(prepared, t.key, Date.now()) : prepared;
      });
    } catch {
      if (!c.signal.aborted) setError("这一桌还没连上。你的书签都在，可以再试一次。");
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }
  function openRoom(context?: ReadingTrailItem[], resumeKey?: string, bookmark?: PassageBookmark) {
    cancelRoomRequests();
    setError(null);
    setFolding(false);
    const reading = context ?? getTrail();
    const id =
      resumeKey ??
      (context === undefined ? seatedRoom() : undefined) ??
      reading.at(-1)?.url ??
      PERSONAL_ROOM;
    setKey(id);
    setOverlay("cabin");
    const b = updateBook((b) => startThread(b, id, reading, Date.now(), bookmark));
    const t = b.threads.find((v) => v.key === id);
    // Merely unfolding the pet isn't permission to send articles. A chosen clip/article is.
    if (
      !t?.result &&
      t?.context.length &&
      (t.context.at(-1)?.origin === "sample" || context?.length)
    )
      void analyze(t);
  }
  function clip(item: ZhihuItem, mark: PassageBookmark) {
    // AnswerCard already recorded this visit; do not count it twice. The history keeps its usual prefix.
    const row =
      getHistory().find((t) => t.url === item.url) ??
      pushTrail(item, question ?? undefined).find((t) => t.url === item.url);
    if (!row) return;
    openRoom(
      [{ ...row, contentText: mark.before + mark.excerpt + mark.after }],
      bookmarkKey(mark),
      mark,
    );
  }
  async function choose(c: { id: string; label: string }) {
    if (!room || choosing || room.committed) return;
    const t = room;
    choiceReq.current?.abort();
    const controller = new AbortController();
    choiceReq.current = controller;
    setChoosing(true);
    setError(null);
    try {
      const res = await fetch("/api/roundtable/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choiceId: c.id,
          choiceLabel: c.label,
          topicTitle: t.title,
        }),
        signal: controller.signal,
      });
      const j = await res.json();
      if (!res.ok || !j.dialogue?.text || !j.microAction) throw Error();
      if (!controller.signal.aborted)
        updateBook((b) =>
          acceptChoice(
            b,
            t.key,
            c.label,
            { text: j.dialogue.text, microAction: j.microAction },
            Date.now(),
            t.turns.at(-1)?.id,
          ),
        );
    } catch {
      if (!controller.signal.aborted) setError("这次选择还没记下，可以再点一次。");
    } finally {
      if (!controller.signal.aborted) setChoosing(false);
    }
  }
  function commit() {
    if (!room?.result || room.committed) return;
    const { result: r } = room;
    const sources = [
      ...new Map([...room.context, ...r.curatedSources].map((s) => [s.url, s])).values(),
    ];
    addJournal(
      {
        topicTitle: (room.context.at(-1)?.origin === "sample" ? "〔试读〕" : "") + r.topicTitle,
        ...(room.bookmark ? { bookmark: room.bookmark } : {}),
        oneLineTakeaway: r.controlCard.oneLineTakeaway,
        microAction: room.followUp?.microAction ?? r.controlCard.microAction,
        catBadgeTheme: r.controlCard.catBadgeTheme,
        catBadgeName: r.controlCard.catBadgeName,
        sources: sources.map(({ title, author, url }) => ({
          title,
          author,
          url,
        })),
      },
      `round:${room.key}`,
    );
    updateBook((b) =>
      changeRoom(b.pending?.key === room.key ? dismissNote(b) : b, room.key, (t) => ({
        ...t,
        committed: true,
        nudgedFor: t.turns.findLast((m) => m.kind === "typed")?.id ?? t.nudgedFor,
      })),
    );
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="reading-app">
        <TopSearchBar
          onSearch={openQuestion}
          onHome={home}
          onHistory={() => setOverlay("shelf")}
          onJournal={() => setOverlay("journal")}
          journalCount={journal.length}
          historyCount={history.length}
        />
        <main className="reading-main">
          <div className="shelf-breadcrumb">
            <Library size={14} /> 伴读书架 <i>/</i> {question ? "正在阅读" : "今日书页"}
            {!question && (
              <a className="prototype-link trial-invite" href="/trial">
                <Feather size={14} /> 窗边试聊 →
              </a>
            )}
          </div>
          {!question && (
            <section className="shelf-hero">
              <div>
                <div className="kicker">
                  <i /> KANSHAN READING CLUB
                </div>
                <h1>
                  看山伴读<span>，</span>
                  <br className="mobile-break" />
                  慢慢翻。
                </h1>
                <p>
                  这里是你的知乎阅读书架。读到想多聊一句的地方，
                  <br className="desktop-break" />
                  就来窗边，和四位伙伴坐一坐。
                </p>
                <button className="hero-imprint" onClick={() => meet("purr_cat")}>
                  <Feather size={13} /> 认识四位伙伴 <ArrowUpRight size={12} />
                </button>
              </div>
              <img src={art.reading} alt="红围巾的刘看山正捧着书阅读" />
            </section>
          )}
          <div className="reading-columns">
            <div className="reading-feed">
              {question ? (
                <QuestionDetail
                  key={question}
                  title={question}
                  items={answers}
                  loading={answersLoading}
                  onBack={home}
                  onRead={read}
                  onClip={clip}
                  recordedUrls={new Set(history.map((t) => t.url))}
                  readerActive={!overlay}
                  sample={sample}
                  degradedReason={reason}
                />
              ) : (
                <>
                  <div className="feed-heading">
                    <div>
                      <span className="kicker">ON THE SHELF</span>
                      <h2>知乎热榜</h2>
                    </div>
                    <small title={quotaNote || undefined}>
                      <i className={live ? "live" : ""} />
                      {hotLoading ? "正在取书" : live ? "实时书单" : "暂未连上书单"}
                    </small>
                  </div>
                  {(hotLoading || hot.length > 0) && (
                    <HotFeedList
                      items={hot}
                      loading={hotLoading}
                      onOpen={(t) => void openQuestion(t.title)}
                    />
                  )}
                  {!hotLoading && !live && (
                    <section className="sample-shelf">
                      <div className="kicker">FROM OUR DESK · 本地试读</div>
                      <h3>先翻一页伴读手记</h3>
                      <p>
                        知乎书单尚未连上。这两篇由伴读编辑室撰写，不是知乎回答；阅读、留便签和开圆桌都可以照常体验。
                      </p>
                      {sampleItems.map((t) => (
                        <button key={t.id} onClick={() => openSample(t)}>
                          <BookOpen size={14} />
                          {t.title}
                          <ArrowUpRight size={14} />
                        </button>
                      ))}
                    </section>
                  )}
                </>
              )}
            </div>
            <aside className="reading-side">
              <div className="side-block">
                <div className="kicker">BOOKMARKS</div>
                <h2>
                  <Bookmark size={17} /> 我的书签
                </h2>
                {history.length ? (
                  <ul>
                    {history
                      .slice(-3)
                      .reverse()
                      .map((t) => (
                        <li key={t.url}>
                          <button onClick={() => openRoom([t])}>{t.title}</button>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>
                    读过的回答会悄悄夹在这里，
                    <br />
                    不用另外按收藏。
                  </p>
                )}
                <button className="text-link" onClick={() => setOverlay("shelf")}>
                  翻开阅读记录 <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="side-block roster">
                <div className="kicker">AT THE TABLE</div>
                <h2>窗边的四位伙伴</h2>
                {(Object.keys(names) as Speaker[]).map((s) => (
                  <button className="roster-row" key={s} onClick={() => meet(s)}>
                    <img src={art.actions[s]} alt="" loading="lazy" />
                    <span>
                      <b>{names[s]}</b>
                      <small>{duties[s]}</small>
                    </span>
                  </button>
                ))}
              </div>
              <a
                className="prototype-link"
                href="/previews/roundtable-v6.1/index.html"
                target="_blank"
                rel="noreferrer"
              >
                <BookOpen size={14} /> 看离线动效样片 ↗
              </a>
            </aside>
          </div>
        </main>
        {!overlay && (
          <KanshanDock
            count={Math.min(5, history.filter((t) => t.origin === history.at(-1)?.origin).length)}
            onOpen={() => openRoom()}
            invited={!!book.pending}
            onDismiss={() => updateBook(dismissNote)}
            onNote={() => {
              if (!book.pending) return;
              const id = book.pending.key;
              updateBook((b) => takeNote(b, id, Date.now()));
              openRoom([], id);
            }}
          />
        )}
        {overlay === "cabin" && (
          <CabinModal
            key={key ?? "empty"}
            room={room}
            draft={draft}
            setDraft={(v) => {
              if (key) setDrafts((d) => ({ ...d, [key]: v }));
            }}
            onClose={close}
            onFoldStart={() => {
              rememberSeat(room);
              setFolding(true);
              cancelRoomRequests();
            }}
            onDraftStart={giveFloorToReader}
            onSay={(s) => {
              giveFloorToReader();
              setError(null);
              if (key) updateBook((b) => say(b, key, s, Date.now()));
            }}
            article={{
              loading,
              error,
              choosing,
              onPersonal: () => openRoom([], PERSONAL_ROOM),
              onRetry: () => {
                if (room?.context.length) void analyze(room);
              },
              onNext: () => {
                if (!room) return;
                if (!room.result) void analyze(room, true);
                else updateBook((b) => nextLine(b, room.key, Date.now()));
              },
              onChoose: choose,
              onCommit: commit,
              onLocate: setViewing,
            }}
          />
        )}
        {overlay === "shelf" && (
          <ReadingNotebook
            history={history}
            book={book}
            temporary={temporary}
            onOpen={(t) => openRoom([t])}
            onResume={(id) => openRoom([], id)}
            onClose={close}
            onToggle={() => updateBook((b) => setNotes(b, !b.enabled))}
            onClear={() => {
              cancelRoomRequests();
              clearCompanion();
              setDrafts({});
              setKey(null);
            }}
          />
        )}
        {overlay === "friends" && <PartnerGuide initial={partner} onClose={close} />}
        {overlay === "journal" && (
          <CatJournalDrawer entries={journal} onClose={close} onLocate={setViewing} />
        )}
        {viewing && (
          <PassageDialog
            mark={viewing}
            body={
              [...answers, ...sampleItems].find(
                (i) => i.url === viewing.url && i.id === viewing.sourceId,
              )?.contentText
            }
            onClose={() => setViewing(null)}
          />
        )}
      </div>
    </MotionConfig>
  );
}
