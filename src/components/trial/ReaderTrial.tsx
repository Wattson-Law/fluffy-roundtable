"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { MotionConfig } from "framer-motion";
import { ArrowRight, Download, Feather, LockKeyhole } from "lucide-react";
import { CabinModal } from "@/components/cabin/CabinModal";
import { art } from "@/lib/art";
import { emptyBook, PERSONAL_ROOM, say, startThread } from "@/lib/companion";
import {
  makeCard,
  marks,
  questions,
  scenes,
  type Mark,
  type Observations,
  type Scene,
  type TrialCard,
} from "@/lib/reader-trial";
import { Facilitator } from "./Facilitator";

// The table owns all raw words. Leaving this component drops the book AND the unsent draft;
// folding just the dialog keeps this one seat. The ballot never receives the book.
function TrialTable({
  scene,
  onFinish,
  onSkip,
}: {
  scene: Scene;
  onFinish: () => void;
  onSkip: () => void;
}) {
  const [book, setBook] = useState(() => startThread(emptyBook(), PERSONAL_ROOM, [], 0));
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  const spoke = book.threads[0].turns.length > 0;
  return (
    <>
      <p className="trial-lead">{scenes[scene].prompt}</p>
      <aside className="trial-note">
        <Feather aria-hidden size={17} />
        <p>任选一桌，在换人或打字时收起小屋，再回来看看。不想试这一步也没关系。</p>
      </aside>
      <div className="trial-actions">
        <button
          className="trial-primary"
          onClick={() => {
            setVisited(true);
            setOpen(true);
          }}
        >
          {visited ? "回到这桌" : "打开小屋"} <ArrowRight size={17} />
        </button>
        <button className="trial-secondary" onClick={spoke ? onFinish : onSkip}>
          {spoke ? "填这桌反馈" : "略过这桌"}
        </button>
      </div>
      <p className="trial-aside">
        收起小屋会保留这桌；进入反馈，就放下这桌的聊天和草稿。
        {!spoke && "略过未聊的一桌，三项均记作没试到。"}
      </p>
      {open && (
        <CabinModal
          room={book.threads[0]}
          draft={draft}
          setDraft={setDraft}
          onClose={() => setOpen(false)}
          onSay={(words) => {
            const now = Date.now();
            setBook((b) => say(b, PERSONAL_ROOM, words, now));
          }}
        />
      )}
    </>
  );
}

function Ballot({ scene, onFinish }: { scene: Scene; onFinish: (answers: Observations) => void }) {
  const [row, setRow] = useState<Partial<Observations>>({});
  const { fit = "unsure", pushed = "unsure", repeated = "unsure" } = row;
  return (
    <form
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        onFinish({ fit, pushed, repeated });
      }}
    >
      <p className="trial-aside">
        这桌的聊天已放下。只勾你想回答的项；留空会记作「没试到／说不清」，不算是或没有。
      </p>
      <div className="trial-ballot">
        {questions.map((q, i) => (
          <fieldset key={q.key}>
            <legend>
              <span>{i + 1}.</span> {q.key === "fit" ? scenes[scene].first : q.text}
            </legend>
            <div className="trial-options">
              {(Object.keys(marks) as Mark[]).map((mark) => (
                <label key={mark}>
                  <input
                    type="radio"
                    name={q.key}
                    value={mark}
                    checked={row[q.key] === mark}
                    onChange={() => setRow((r) => ({ ...r, [q.key]: mark }))}
                  />
                  <span>{marks[mark]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <button className="trial-primary">
        {scene === "change" ? "去第二桌" : "查看反馈卡"} <ArrowRight size={16} />
      </button>
    </form>
  );
}

function downloadCard(card: TrialCard) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(card, null, 2) + "\n"], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "窗边试聊-匿名反馈.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function TrialVisit({ onReset }: { onReset: () => void }) {
  const [step, setStep] = useState<"welcome" | "table" | "ballot" | "done">("welcome");
  const [scene, setScene] = useState<Scene>("change");
  const [first, setFirst] = useState<Observations>();
  const [card, setCard] = useState<TrialCard>();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [step, scene]);
  const welcome = step === "welcome",
    active = step === "table" || step === "ballot";
  function finish(answers: Observations) {
    if (scene === "change") {
      setFirst(answers);
      setScene("support");
      setStep("table");
    } else if (first) {
      setCard(makeCard(first, answers));
      setFirst(undefined);
      setStep("done");
    }
  }
  const title = welcome
    ? "窗边试聊"
    : step === "done"
      ? "这是你的反馈卡"
      : step === "ballot"
        ? "这桌，聊得怎么样？"
        : scenes[scene].title;
  return (
    <div className="trial-page">
      <header className="trial-mast">
        <span>
          <Feather size={19} /> 毛茸茸圆桌
        </span>
        <small>
          <LockKeyhole size={13} /> 只在本机
        </small>
      </header>
      <main className="trial-main">
        <article className={"trial-sheet" + (welcome ? " trial-cover" : "")}>
          <div className="trial-copy">
            <p className="trial-kicker">
              {welcome
                ? "窗边来信　/　读者试坐"
                : step === "done"
                  ? "两桌之后　/　自愿带走"
                  : `第 ${scenes[scene].number} 桌　/　${step === "table" ? "情境签" : "反馈签"}`}
            </p>
            <h1 tabIndex={-1} ref={heading}>
              {title}
            </h1>
            {welcome && (
              <>
                <p className="trial-lead">
                  到小屋里和伙伴聊两件小事。怎么开口、什么时候改主意，都由你。
                </p>
                <p className="trial-aside">
                  不用真事，也不用报名字。小屋不读取你的书架，不保存或上传聊天。最后由你决定，要不要带走一张只记勾选的反馈卡。
                </p>
                <button className="trial-primary" onClick={() => setStep("table")}>
                  开始试聊 <ArrowRight size={17} />
                </button>
              </>
            )}
            {step === "table" && (
              <TrialTable
                key={scene}
                scene={scene}
                onFinish={() => setStep("ballot")}
                onSkip={() => finish({ fit: "unsure", pushed: "unsure", repeated: "unsure" })}
              />
            )}
            {step === "ballot" && <Ballot scene={scene} onFinish={finish} />}
            {step === "done" && card && (
              <>
                <p className="trial-aside">
                  两桌各三项，没有名字、时间或原话。没有自动提交；愿意的话，下载后只把这张卡交给邀请你的人。
                </p>
                <div className="trial-receipt">
                  {(Object.keys(scenes) as Scene[]).map((s) => (
                    <section key={s}>
                      <h2>
                        {scenes[s].number} · {scenes[s].title}
                      </h2>
                      <dl>
                        {questions.map((q) => (
                          <div key={q.key}>
                            <dt>{q.short}</dt>
                            <dd>{marks[card[s][q.key]]}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                </div>
                <div className="trial-actions">
                  <button className="trial-primary" onClick={() => downloadCard(card)}>
                    <Download size={16} /> 下载匿名反馈卡
                  </button>
                  <button className="trial-secondary" onClick={onReset}>
                    交给下一位读者
                  </button>
                </div>
                <p className="trial-aside">不想留下就直接换人；已下载的文件由你保管或删除。</p>
              </>
            )}
          </div>
          {welcome && (
            <figure className="trial-portrait">
              <img src={art.ink[0]} alt="刘看山伏在窗边写字" />
              <figcaption>窗边留了一个位置。</figcaption>
            </figure>
          )}
        </article>
        {active && (
          <div className="trial-end">
            <span>刷新或离开会结束本次试聊。</span>
            <button onClick={onReset}>丢弃本次试聊</button>
          </div>
        )}
        {welcome && <Facilitator />}
      </main>
    </div>
  );
}

export function ReaderTrial() {
  const [visit, setVisit] = useState(0);
  useEffect(() => {
    // A browser's back/forward cache may freeze a DOM instead of unmounting it.
    const leave = () => flushSync(() => setVisit((v) => v + 1));
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <TrialVisit key={visit} onReset={() => setVisit((v) => v + 1)} />
    </MotionConfig>
  );
}
