import test from "node:test";
import assert from "node:assert/strict";
import { makeCard, parseCard, tallyCards } from "../src/lib/reader-trial.ts";

const first = { fit: "yes", pushed: "no", repeated: "unsure" };
const second = { fit: "no", pushed: "yes", repeated: "no" };
const privateText = "验收虚构原话，不得进入反馈";

test("feedback contains only the six selected observations, with no reader or chat fields", () => {
  const card = makeCard({ ...first, draft: privateText }, { ...second, turns: [privateText] });
  assert.deepEqual(card, { format: "window-seat/v1", change: first, support: second });
  assert.doesNotMatch(JSON.stringify(card), /验收虚构原话/);
  assert.deepEqual(parseCard(JSON.parse(JSON.stringify(card))), card);
  assert.throws(() => makeCard({ ...first, fit: privateText }, second));
});
test("the facilitator rejects incomplete, unrecognised and over-sharing cards as a whole", () => {
  const card = makeCard(first, second);
  for (const item of [
    null,
    [],
    {},
    { ...card, format: "v2" },
    { ...card, reader: privateText },
    { ...card, change: { ...first, note: privateText } },
    { ...card, support: { fit: "yes" } },
    { ...card, support: { ...second, repeated: null } },
    { ...card, change: ["yes", "no", "unsure"] },
  ]) {
    assert.equal(parseCard(item), null);
  }
});
test("five independent readers can agree; indeterminate observations stay out of yes/no", () => {
  const unsure = { fit: "unsure", pushed: "unsure", repeated: "unsure" };
  const cards = [
    makeCard(first, second),
    makeCard(first, second),
    makeCard(second, first),
    makeCard(unsure, unsure),
    makeCard(unsure, unsure),
  ];
  const totals = tallyCards(cards);
  assert.deepEqual(totals.change.fit, { yes: 2, no: 1, unsure: 2 });
  assert.deepEqual(totals.change.repeated, { yes: 0, no: 1, unsure: 4 });
  assert.deepEqual(totals.support.pushed, { yes: 2, no: 1, unsure: 2 });
  assert.throws(() => tallyCards([]));
  assert.throws(() => tallyCards([...cards, cards[0]]));
});
