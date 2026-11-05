import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'仓位实验室 · Crypto Position Calculator',description:'先定义风险，再决定仓位。高精度 USDT 本位永续合约仓位计算、分批止盈与风险分析。'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="zh-CN" suppressHydrationWarning><body>{children}</body></html>}
