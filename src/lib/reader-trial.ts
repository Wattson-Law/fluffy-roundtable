/** The only data allowed across the boundary between a private table and its feedback card. */
export const scenes = {
  change: {
    number: "01",
    title: "聊到一半，换个需要",
    prompt:
      "想一件让你有些拿不准的小事。先请伙伴帮你想一想；聊到一半，试着告诉它们，你现在更希望它们怎么陪你。",
    first: "你改口后，伙伴的第一句是你当时想听的吗？",
  },
  support: {
    number: "02",
    title: "主意定了，还有个难处",
    prompt:
      "另想一件你已经决定去做的事，只是现实里还有个小麻烦。这回你想要的是支持。把这两层意思用你自己的话告诉伙伴。",
    first: "听到你的决定和难处后，伙伴的第一句是你想听的吗？",
  },
} as const;
export type Scene = keyof typeof scenes;
export const questions = [
  { key: "fit", short: "第一句接对了" },
  {
    key: "pushed",
    short: "追问或硬把旧话说完",
    text: "伙伴有没有反复追问，或把你不想听的话硬讲完？",
  },
  { key: "repeated", short: "需要再解释", text: "你有没有得再解释一次，伙伴才明白你的意思？" },
] as const;
export const marks = { yes: "是", no: "没有", unsure: "没试到／说不清" } as const;
export type Mark = keyof typeof marks;
export type Observations = Record<(typeof questions)[number]["key"], Mark>;
export type TrialCard = Record<Scene, Observations> & { format: "window-seat/v1" };
export const MAX_CARDS = 5;

function hasOnly(value: unknown, keys: string[]): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((k) => Object.hasOwn(value, k))
  );
}
const isMark = (value: unknown): value is Mark =>
  typeof value === "string" && Object.hasOwn(marks, value);
function isRow(value: unknown): value is Observations {
  return (
    hasOnly(
      value,
      questions.map((q) => q.key),
    ) && questions.every((q) => isMark(value[q.key]))
  );
}

export function makeCard(change: Observations, support: Observations): TrialCard {
  // Project, never spread caller objects: drafts, names, clocks and turn IDs cannot escape.
  function project({ fit, pushed, repeated }: Observations) {
    const row = { fit, pushed, repeated };
    if (!isRow(row)) throw new Error("反馈项不完整");
    return row;
  }
  return { format: "window-seat/v1", change: project(change), support: project(support) };
}
export function parseCard(value: unknown): TrialCard | null {
  return hasOnly(value, ["format", "change", "support"]) &&
    value.format === "window-seat/v1" &&
    isRow(value.change) &&
    isRow(value.support)
    ? makeCard(value.change, value.support)
    : null;
}
export function tallyCards(cards: TrialCard[]) {
  if (cards.length < 1 || cards.length > MAX_CARDS) throw new Error("请选择一到五份反馈卡");
  function row(scene: Scene) {
    const counts = () => ({ yes: 0, no: 0, unsure: 0 });
    const result = { fit: counts(), pushed: counts(), repeated: counts() };
    for (const card of cards) for (const { key } of questions) result[key][card[scene][key]]++;
    return result;
  }
  return { change: row("change"), support: row("support") };
}
