import "server-only";
import { parsePetRequest } from "@/lib/pet-dialogue";
import { planPetTurn } from "@/lib/pet-turn-plan";
import { requestPetReply } from "@/lib/pet-model";

// A single local development process shares the individual test plan. Never queue abandoned turns.
const MAX_IN_FLIGHT = 4;
let inFlight = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function localRequest(req: Request) {
  const host = req.headers.get("host")?.toLowerCase();
  if (!host || !/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) return false;
  const origin = req.headers.get("origin");
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    return !origin || new URL(origin).host === host;
  } catch {
    return false;
  }
}
function credentials() {
  if (process.env.NODE_ENV !== "development") return null;
  const key = process.env.QWEN_TOKEN_PLAN_INDIVIDUAL_API_KEY?.trim(),
    model = process.env.PET_CHAT_MODEL?.trim();
  return process.env.PET_CHAT_TEST === "1" && key && model ? { key, model } : null;
}
export function GET(req: Request) {
  const c = localRequest(req) && credentials();
  return json(c ? { enabled: true, model: c.model } : { enabled: false });
}
export async function POST(req: Request) {
  if (!localRequest(req)) return json({ error: "local_only" }, 403);
  const c = credentials();
  if (!c) return json({ error: "offline" }, 503);
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return json({ error: "input" }, 415);
  if (Number(req.headers.get("content-length")) > 16_384) return json({ error: "input" }, 413);
  let p;
  try {
    const bytes = await req.arrayBuffer();
    if (bytes.byteLength > 16_384) return json({ error: "input" }, 413);
    p = parsePetRequest(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return json({ error: "input" }, 400);
  }
  if (!p) return json({ error: "input" }, 400);
  const plan = planPetTurn(p);
  if (p.mode === "handoff" && plan.floor === "reader") return json({ source: "reader_floor" });
  if (!p.reading && plan.fact) return json({ error: "no_reading" }, 422);
  if (inFlight >= MAX_IN_FLIGHT) return json({ error: "busy" }, 429);
  inFlight++;
  try {
    const reply = await requestPetReply(p, c, req.signal);
    return reply
      ? json({ source: "model", model: c.model, reply })
      : json({ source: "reader_floor" });
  } catch (e) {
    const error = (e as Error).message;
    return json(
      { error },
      error === "no_reading"
        ? 422
        : error === "limited"
          ? 429
          : error === "timeout"
            ? 504
            : error === "cancelled"
              ? 499
              : 502,
    );
  } finally {
    inFlight--;
  }
}
