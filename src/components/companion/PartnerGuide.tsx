"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { art } from "@/lib/art";
import { names, duties } from "@/lib/companion";
import type { Speaker } from "@/types";
import { PaperDialog } from "./PaperDialog";
import writing from "../../../assets/action-poses/v1/poses/liukanshan-writing.png";
import walking from "../../../assets/action-poses/v1/poses/ginger-cat-walking.png";
import butterfly from "../../../assets/action-poses/v1/poses/ginger-cat-chasing-butterfly.png";
import flying from "../../../assets/action-poses/v1/poses/owl-flying.png";
import owlLaugh from "../../../assets/action-poses/v1/poses/owl-laughing.png";
import ball from "../../../assets/action-poses/v1/poses/shiba-chasing-ball.png";
import rest from "../../../assets/action-poses/v1/poses/shiba-resting.png";
const profiles: Record<Speaker, { motto: string; description: string; poses: [string, string][] }> = {
  purr_cat: {
    motto: "椅子给你暖好了，慢慢说。",
    description:
      "我先听你说，不急着给办法。你在小屋说过的话，我才会用来想下一张便签怎么写；你想安静，我就不来敲窗。",
    poses: [
      ["睡觉", art.sleeping],
      ["猫步", walking.src],
      ["追逐蝴蝶", butterfly.src],
    ],
  },
  owl: {
    motto: "把书页摊开，我们看这一句。",
    description:
      "哪一句来自原文，哪一句只是判断，我来分开。有可以核对的出处，就把引文和链接摆在一起；没有查到，就留白。",
    poses: [
      ["飞行", flying.src],
      ["低头沉思", art.actions.owl],
      ["大笑", owlLaugh.src],
    ],
  },
  shiba: {
    motto: "你往前走一步，我就陪一步。",
    description:
      "想试一试时，我可以陪你迈第一步。只想听一句加油，我就陪在这儿。聊文章也能一起看评论，但别人的经历不能替你做决定。",
    poses: [
      ["大笑", art.actions.shiba],
      ["追逐皮球", ball.src],
      ["睡觉休息", rest.src],
    ],
  },
  kanshan: {
    motto: "笔先放这儿，最后一行留给你。",
    description:
      "你读的时候，我在窗沿夹书签，不打断你。散会前我把大家的话收成一件小事；要不要放进手账，由你拍板。",
    poses: [
      ["伏案写字", writing.src],
      ["拿放大镜观察", art.actions.kanshan],
      ["看书", art.reading],
    ],
  },
};
export function PartnerGuide({ initial, onClose }: { initial: Speaker; onClose: () => void }) {
  const [s, set] = useState(initial),
    [n, pose] = useState(0);
  const profile = profiles[s];
  return (
    <PaperDialog className="shelf-dialog" label="四位伙伴的名册" onClose={onClose}>
      <div className="shelf-content">
        <header className="sheet-header">
          <div>
            <div className="kicker">MEET THE TABLE</div>
            <h2>窗边的伙伴名册</h2>
          </div>
          <button className="icon-b" onClick={onClose} aria-label="关闭名册">
            <X size={18} />
          </button>
        </header>
        <div className="shelf-list">
          <nav className="guide-tabs" aria-label="选择伙伴">
            {(Object.keys(profiles) as Speaker[]).map((a) => (
              <button
                key={a}
                data-speaker={a}
                aria-pressed={a === s}
                onClick={() => {
                  set(a);
                  pose(0);
                }}
              >
                {names[a]}
              </button>
            ))}
          </nav>
          <div className="guide-portrait" data-speaker={s}>
            <img key={`${s}-${n}`} src={profile.poses[n][1]} alt={`${names[s]}：${profile.poses[n][0]}`} />
          </div>
          <div className="guide-info">
            <div className="kicker">{duties[s]}</div>
            <h3>{names[s]}</h3>
            <p className="guide-motto">{profile.motto}</p>
            <p>{profile.description}</p>
          </div>
          <div className="guide-tabs" aria-label="选择动作">
            {profile.poses.map(([label], i) => (
              <button key={label} aria-pressed={i === n} onClick={() => pose(i)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PaperDialog>
  );
}
