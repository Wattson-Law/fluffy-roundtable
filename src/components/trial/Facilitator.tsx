"use client";
import { useRef, useState } from "react";
import { ChevronDown, FolderOpen } from "lucide-react";
import {
  MAX_CARDS,
  parseCard,
  questions,
  scenes,
  tallyCards,
  type Scene,
  type TrialCard,
} from "@/lib/reader-trial";

/** The picker reads files locally; neither their contents nor their names are displayed on error. */
export function Facilitator() {
  const [batch, setBatch] = useState<TrialCard[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const read = useRef(0);
  const totals = batch.length ? tallyCards(batch) : null;
  function clear() {
    read.current++;
    setBatch([]);
    setError("");
    setBusy(false);
  }
  async function add(files: File[]) {
    if (!files.length) return;
    const turn = ++read.current;
    setBusy(true);
    setError("");
    try {
      if (batch.length + files.length > MAX_CARDS || files.some((f) => f.size > 2048))
        throw new Error();
      const cards = await Promise.all(
        files.map(async (f) => {
          const card = parseCard(JSON.parse(await f.text()));
          if (!card) throw new Error();
          return card;
        }),
      );
      if (turn === read.current) setBatch([...batch, ...cards]);
    } catch {
      if (turn === read.current)
        setError("这批没有加入。请只选本版反馈卡，合计不超过五份；已有汇总不变。");
    } finally {
      if (turn === read.current) setBusy(false);
    }
  }
  return (
    <details
      className="trial-facilitator"
      onToggle={(e) => {
        if (!e.currentTarget.open) clear();
      }}
    >
      <summary>
        <FolderOpen size={16} /> 主持人：汇总反馈卡 <ChevronDown size={15} />
      </summary>
      <p>
        每人只加一份，可以一份份加，也可以多选。不上传文件。「未确定」不算接对，也不算接错。合上这里会清空汇总。
      </p>
      <label className="trial-file">
        选择反馈卡
        <input
          type="file"
          accept=".json,application/json"
          multiple
          disabled={busy}
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = "";
            void add(files);
          }}
        />
      </label>
      <span className="sr-only" role="status" aria-live="polite">
        {busy ? "正在读取反馈卡" : batch.length ? `已汇总 ${batch.length} 份` : ""}
      </span>
      {error && <p role="alert">{error}</p>}
      {(batch.length > 0 || error) && (
        <button className="trial-secondary" onClick={clear}>
          清空汇总
        </button>
      )}
      {totals && (
        <table className="trial-tally">
          <caption>本次选入 {batch.length} 份反馈卡 · 非自动收集</caption>
          <thead>
            <tr>
              <th scope="col">桌次／观察项</th>
              <th scope="col">是</th>
              <th scope="col">没有</th>
              <th scope="col">未确定</th>
            </tr>
          </thead>
          {(Object.keys(scenes) as Scene[]).map((scene) => (
            <tbody key={scene}>
              {questions.map(({ key, short }) => {
                const n = totals[scene][key];
                return (
                  <tr key={key}>
                    <th scope="row">
                      {scenes[scene].number} · {short}
                    </th>
                    <td>{n.yes}</td>
                    <td>{n.no}</td>
                    <td>{n.unsure}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      )}
    </details>
  );
}
