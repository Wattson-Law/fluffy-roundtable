/**
 * POST /api/roundtable/analyze —— 圆桌分析主流水线（施工蓝图 §5.3）
 *
 * 1. 接收前端 readingTrail（最多 5 篇用户刚看过的真实帖子）
 * 2. 并发补充真实素材：global_search ×1（站外对照）+ zhihu_search ×1（柴犬候选池）
 * 3. 素材严格编号 READ_x / EXT_x / NEW_x
 * 4. LLM 强制 JSON 输出 → 服务端逐字校验引文 + 按编号回填真实 Url/Title/Author
 * 5. LLM 不可用/超时/输出不合格 → 规则引擎兜底，永不白屏
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyFocus } from "@/lib/bookmarks";
import { focusRound } from "@/lib/focused-round";
import { shapeRoles } from "@/lib/companion";
import { createHash } from "node:crypto";
import { TTL, cacheGet, cacheSet } from "@/lib/cache";
import { searchGlobal, searchZhihu } from "@/lib/zhihu-client";
import {
  buildPool,
  callLlm,
  computeRadar,
  detectMode,
  getLastLlmError,
  llmConfigured,
  sanitizeControlCard,
  sanitizeDialogues,
} from "@/lib/llm";
import {
  buildControlCard,
  buildFallbackDialogues,
  buildFollowUp,
  buildKanshanClose,
  buildShibaDeliver,
  pickCuratedSources,
} from "@/lib/fallback-engine";
import type { CuratedSource, ReadingTrailItem, RoundtableResult, ZhihuItem } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  trail?: ReadingTrailItem[];
  topicHint?: string;
  focus?: unknown;
}

function trailToItem(t: ReadingTrailItem): ZhihuItem {
  return {
    id: t.id,
    title: t.title.slice(0, 240),
    contentText: t.contentText.slice(0, 1500),
    url: t.url,
    author: t.author ?? "知乎用户",
    authoritylevel: t.authoritylevel ?? 0,
    voteUpCount: t.voteUpCount ?? 0,
    commentCount: 0,
    comments: Array.isArray(t.comments)
      ? t.comments
          .filter((s): s is string => typeof s === "string")
          .slice(0, 4)
          .map((s) => s.slice(0, 300))
      : [],
  };
}

/** 从已读帖提炼「避坑/实操」向检索词，供柴犬二次检索 */
function buildShibaQuery(trail: ZhihuItem[], topicHint: string): string {
  const base =
    topicHint.trim() || trail[0]?.title.replace(/[？?！!。，,]/g, " ").slice(0, 24) || "";
  const core = base.replace(/(是什么体验|为什么|如何看待|怎么办|知乎)/g, "").trim();
  return `${core} 真实经验 避坑 复盘`.replace(/\s+/g, " ").trim();
}

/** 站外客观素材检索词 */
function buildExtQuery(trail: ZhihuItem[], topicHint: string): string {
  const base = topicHint.trim() || trail[0]?.title.slice(0, 20) || "";
  const core = base.replace(/(是什么体验|为什么|如何看待|怎么办|知乎)/g, "").trim();
  return `${core} 数据 报告 现状`.replace(/\s+/g, " ").trim();
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  // Only the selected public reading excerpts belong here. Local trial links and chat turns do not.
  const rawTrail = Array.isArray(body?.trail)
    ? body.trail
        .slice(-5)
        .filter(
          (t) =>
            t &&
            t.origin !== "sample" &&
            typeof t.id === "string" &&
            typeof t.url === "string" &&
            /^https?:\/\//i.test(t.url) &&
            typeof t.title === "string" &&
            typeof t.contentText === "string",
        )
    : [];

  if (rawTrail.length === 0) {
    return NextResponse.json(
      { error: "empty_trail", message: "还没看过帖子呢，先去刷两篇再叫我们开会吧～" },
      { status: 400 },
    );
  }

  const trail = rawTrail.map(trailToItem);
  const focus = verifyFocus(trail, body.focus);
  if (body.focus !== undefined && (!focus || body.trail?.length !== 1))
    return NextResponse.json({ error: "invalid_focus", message: "书签与这篇正文对不上，请回到原文重新选一句。" }, { status: 400 });
  const topicHint = (
    typeof body?.topicHint === "string"
      ? body.topicHint
      : rawTrail.at(-1)?.fromQuestion || trail.at(-1)!.title
  ).slice(0, 80);
  const mode = detectMode(trail, topicHint);

  // 同一组已读帖 + 同一主题，30 分钟内复用结果，防重复烧额度
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        topicHint, focus,
        trail.map((t) => [
          t.id,
          t.url,
          t.title,
          t.contentText,
          t.author,
          t.authoritylevel,
          t.voteUpCount,
          t.comments,
        ]),
      ]),
    )
    .digest("hex");
  const cacheKey = `rt:${mode}:${fingerprint}`;
  const cachedResult = cacheGet<RoundtableResult>(cacheKey);
  if (cachedResult) {
    return NextResponse.json({ ...cachedResult, meta: { ...cachedResult.meta, note: "命中缓存" } });
  }

  /* ---------- 2. 并发补充真实外部素材（各最多 1 次） ---------- */
  const shibaQuery = buildShibaQuery(trail, topicHint);
  const extQuery = buildExtQuery(trail, topicHint);

  const [extRes, freshRes] = await Promise.all([
    searchGlobal(extQuery, 5),
    searchZhihu(shibaQuery, 10),
  ]);

  const ext = extRes.data.slice(0, 5);
  const readUrls = new Set(trail.map((t) => t.url));
  const fresh = freshRes.data.filter((f) => !readUrls.has(f.url)).slice(0, 10);

  /* ---------- 3. 素材编号 ---------- */
  const pool = buildPool(trail, ext, fresh);

  /* ---------- 规则兜底结果（始终先算好，保证永不白屏） ---------- */
  const radar = computeRadar(trail, mode);
  const fallbackSources = pickCuratedSources(fresh, trail, topicHint);
  const fallbackDialogues = [
    ...buildFallbackDialogues(trail, ext, mode),
    buildShibaDeliver(fallbackSources, shibaQuery),
    buildKanshanClose(fallbackSources.length, mode),
  ];
  const fallbackCard = buildControlCard(trail, fallbackSources, mode, topicHint);

  let result: RoundtableResult = {
    mode,
    topicTitle: topicHint,
    radar,
    dialogues: fallbackDialogues,
    curatedSources: fallbackSources,
    followUpQuestion: buildFollowUp(mode),
    controlCard: fallbackCard,
    meta: {
      llmUsed: false,
      degraded: !llmConfigured,
      note: llmConfigured ? undefined : "未配置 LLM，当前由规则引擎生成圆桌剧本",
      trailCount: trail.length,
    },
  };

  /* ---------- 4. LLM 路径（成功才覆盖兜底） ---------- */
  if (llmConfigured) {
    const raw = await callLlm(mode, topicHint, pool, focus?.excerpt);
    if (!raw) {
      // 如实记录降级原因（余额不足 / 限流 / 超时），不假装用了 LLM
      const why = getLastLlmError();
      if (why) {
        result.meta.degraded = true;
        result.meta.note = why;
      }
    }
    if (raw) {
      const dialogues = sanitizeDialogues(raw, pool);
      // 台词太少说明模型跑偏或被红线过滤殆尽，弃用并保留兜底
      if (dialogues.length < 4) {
        result.meta.degraded = true;
        result.meta.note = "LLM 输出未通过红线与溯源校验，已回退规则引擎";
      }
      if (dialogues.length >= 4) {
        // curatedSourceTags 只能映射真实对象，LLM 永远不生成 URL
        const picked: CuratedSource[] = [];
        for (const tag of raw.curatedSourceTags ?? []) {
          const it = pool.fresh.get(tag);
          if (!it) continue;
          if (picked.some((p) => p.url === it.url)) continue;
          const match = fallbackSources.find((s) => s.url === it.url);
          picked.push({
            title: it.title,
            author: it.author,
            url: it.url,
            voteUpCount: it.voteUpCount,
            authoritylevel: it.authoritylevel,
            excerpt: match?.excerpt ?? it.contentText.slice(0, 120),
            why: match?.why ?? "柴犬按你的处境重新挑出来的",
          });
          if (picked.length >= 3) break;
        }

        const sources = picked.length ? picked : fallbackSources;
        const hasShibaDeliver = dialogues.some((d) => d.speaker === "shiba" && d.text.length > 10);

        result = {
          mode: (["anti_anxiety", "decision_debate", "topic_digest"] as const).includes(
            raw.mode as never,
          )
            ? (raw.mode as RoundtableResult["mode"])
            : mode,
          topicTitle: (raw.topicTitle || topicHint).slice(0, 80),
          radar,
          dialogues: shapeRoles(dialogues, fallbackDialogues),
          curatedSources: sources,
          followUpQuestion:
            raw.followUpQuestion?.prompt && raw.followUpQuestion.choices?.length
              ? {
                  prompt: raw.followUpQuestion.prompt.slice(0, 120),
                  choices: raw.followUpQuestion.choices
                    .filter((c) => c.id && c.label)
                    .slice(0, 3)
                    .map((c) => ({ id: String(c.id), label: String(c.label).slice(0, 40) })),
                }
              : buildFollowUp(mode),
          controlCard: sanitizeControlCard(raw, fallbackCard),
          meta: {
            llmUsed: true,
            degraded: false,
            note: hasShibaDeliver ? undefined : "柴犬环节由规则补全",
            trailCount: trail.length,
          },
        };
      }
    }
  }

  // API 层降级提示（搜索失败不阻断演出，只做标注）
  if (extRes.degraded && freshRes.degraded) {
    result.meta.degraded = true;
    result.meta.note = "外部检索暂时不可用，本轮只基于你刚看过的帖子分析";
  }

  if (focus) result = focusRound(result, trail[0], focus.excerpt);
  cacheSet(cacheKey, result, TTL.ROUNDTABLE);
  return NextResponse.json(result);
}
