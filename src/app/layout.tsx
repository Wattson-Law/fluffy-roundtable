import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "毛茸茸圆桌 · 在这儿刷知乎。刷完乱了，就问它们。",
  description:
    "它知道你刚才看了什么，也一直都在。四只小动物围着篝火，陪你把刚刷过的真实知乎帖子理清楚。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#142126",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
