/**
 * POST /api/roundtable/follow-up —— 决策追问后的刘看山定制拍板（§3.3 轻交互芯片）
 * 纯规则生成，不额外烧 LLM 与知乎额度。
 */
import { NextRequest, NextResponse } from "next/server";
import type { DialogueLine } from "@/types";

export const runtime = "nodejs";

interface Body {
  choiceId?: string;
  choiceLabel?: string;
  topicTitle?: string;
}

export async function POST(req: NextRequest) {
  const { choiceId = "", choiceLabel = "", topicTitle = "" } =
    (await req.json().catch(() => ({}))) as Body;

  const shortTerm = choiceId === "short_term" || /现金流|确定性|一年|短期/.test(choiceLabel);

  const line: DialogueLine = {
    speaker: "kanshan",
    mood: "calm",
    text: shortTerm
      ? `既然你更看重眼下的确定性，那判断标准就清楚了：优先选能在半年内看到回报、失败成本低的那条路，别被"三年后会怎样"的宏大叙事牵着走。先稳住现金流，复利可以之后再补。`
      : `既然你愿意为三年后的复利让渡一点眼前收益，那就别太在意起步的薪资落差，重点看这条路能不能持续积累可迁移的东西。只提醒一句：给自己定一个止损期限，别无限期耗着。`,
  };

  const microAction = shortTerm
    ? "今晚列出 3 个半年内能验证的小目标，挑最容易启动的那个，明天就动。"
    : "今晚写下你希望三年后掌握的那项核心能力，再倒推这个月能开始积累的第一步。";

  return NextResponse.json({
    dialogue: line,
    microAction,
    topicTitle,
  });
}
