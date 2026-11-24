import type { Metadata } from "next";
import { ReaderTrial } from "@/components/trial/ReaderTrial";
import "./trial.css";

export const metadata: Metadata = {
  title: "窗边试聊 · 毛茸茸圆桌",
  description: "两桌不记名的小屋试聊。用你自己的话，不留下聊天记录。",
  robots: { index: false, follow: false },
};

export default function TrialPage() {
  return <ReaderTrial />;
}
