import type { Metadata } from "next";
import "./globals.css";
import { ResearchProvider } from "@/components/provider";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: "十分钟 SIGNAL · 信号研究仪表盘",
  description:
    "基于 EMA、RSI 与成交量过滤的短周期信号研究工具。仅供研究学习，不构成任何投资建议。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <ResearchProvider>
          <Shell>{children}</Shell>
        </ResearchProvider>
      </body>
    </html>
  );
}
