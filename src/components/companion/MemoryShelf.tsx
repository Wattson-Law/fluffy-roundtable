"use client";
import { useState } from "react";
import type { Book } from "@/lib/companion";
import {
  memoryTopicName,
  sensitiveText,
  type MemoryAction,
  type SharedMemory,
} from "@/lib/shared-memory";
export function MemoryShelf({
  book,
  onAction,
  onEdit,
}: {
  book: Book;
  onAction: (id: string, op: MemoryAction) => void;
  onEdit: (id: string, label: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState("");
  const all = book.memories ?? [],
    muted = book.mutedMemoryTopics ?? [];
  return (
    <section className="memory-shelf" aria-label="伙伴记得的事">
      <p className="muted">
        四位伙伴共用这份本机小记。只记你亲口提过的近况，不从书架猜；不发给在线模型。不想自动记的事，也可以说「忘了这件事」。
      </p>
      {!all.length && <p>这里还空着。愿意的话，可以说「帮我记住，我正在准备第一次读诗会」。</p>}
      {all.map((m) => (
        <article className="shelf-row memory-row" key={m.id}>
          <small>
            {new Date(m.at).toLocaleDateString("zh-CN")} ·{" "}
            {muted.includes(m.id) ? "不会主动问" : "来自你自己说的话"}
          </small>
          {editing === m.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim() || sensitiveText.test(draft)) return;
                onEdit(m.id, draft);
                setEditing(null);
              }}
            >
              <label>
                现在该怎么记
                <input
                  aria-label="更正这条近况"
                  value={draft}
                  maxLength={50}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <div>
                <button disabled={!draft.trim() || sensitiveText.test(draft)}>保存更正</button>
                <button type="button" onClick={() => setEditing(null)}>
                  取消
                </button>
              </div>
              {sensitiveText.test(draft) && <small>这类私人信息不记在小记里。</small>}
            </form>
          ) : (
            <>
              <h3>{m.label}</h3>
              <div>
                <button
                  onClick={() => {
                    setDraft(m.label);
                    setEditing(m.id);
                  }}
                >
                  更正
                </button>
                <button onClick={() => onAction(m.id, muted.includes(m.id) ? "unmute" : "mute")}>
                  {muted.includes(m.id) ? "允许主动问" : "不再主动问"}
                </button>
                <button onClick={() => onAction(m.id, "forget")}>忘了这件事</button>
              </div>
            </>
          )}
        </article>
      ))}
      {muted
        .filter((id) => !all.some((m) => m.id === id))
        .map((id) => (
          <div className="privacy-row" key={id}>
            <span>{memoryTopicName(id)} · 不会主动问</span>
            <button onClick={() => onAction(id, "unmute")}>允许主动问</button>
          </div>
        ))}
    </section>
  );
}
export function MemorySlip({ memory, undo }: { memory: SharedMemory; undo: () => void }) {
  return (
    <aside className="memory-slip">
      <span>本机记下了：{memory.label}</span>
      <button onClick={undo}>撤回这条记忆</button>
    </aside>
  );
}
