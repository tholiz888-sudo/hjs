# 10 分钟涨跌信号仪表盘：完整项目代码

仅供研究学习，不构成任何投资建议。历史表现不代表未来结果，交易有风险，请谨慎决策。

本文件按需求的七个部分收录当前可运行实现；代码文件是同目录中的实际源文件。运行 `npm ci --cache /tmp/hjs-npm-cache`、`npm run dev`，默认开发端口 3010。生产运行 `npm run build` 后 `npm start`，自动读取 PORT。

## 1. 项目整体目录结构

```text
signal-dashboard/
  app/
    layout.tsx
    globals.css
    page.tsx
    rules/page.tsx
    backtest/page.tsx
    api/market/route.ts
  components/
    shell.tsx
    provider.tsx
    charts.tsx
    market-controls.tsx
    signal-alerts.tsx
    ui/{button,card,badge,input,switch}.tsx
  lib/
    engine.ts
    market-data.ts
    binance.ts
    okx.ts
    market-types.ts
    chart-data.ts
    alerts.ts
    use-market.ts
    utils.ts
  tests/engine.test.ts
  e2e/dashboard.spec.ts
  playwright.config.ts
  package.json
  package-lock.json
  components.json
  tailwind.config.ts
  tsconfig.json
  postcss.config.js
  next.config.mjs
  render.yaml
  README.md
```

## 2. 关键依赖

Next.js 15.5.29 App Router（安全修复升级）、React 18、TypeScript、Tailwind CSS 3、Radix/shadcn UI 基础组件及 Recharts。


### `package.json`

```json
{
  "name": "ten-minute-signal-dashboard",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -H 0.0.0.0 -p 3010",
    "build": "next build",
    "start": "next start -H 0.0.0.0",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "tsx --test tests/*.test.ts",
    "test:browser": "playwright test"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.4.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "next": "15.5.29",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.15.4",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.65.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.32",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.20.0",
    "typescript": "^5.7.0"
  },
  "engines": {
    "node": "24.x"
  },
  "overrides": {
    "postcss": "$postcss"
  }
}
```

## 3. 全局布局与主题配置

所有页面共享固定且不可关闭的顶部风险条、完整页脚声明、响应式导航和参数上下文。有效参数即时共享并存入 localStorage；无效输入保留最后有效参数。包含运行所需的配置与本地 shadcn/ui 基础组件。


### `app/layout.tsx`

```tsx
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
```


### `components/shell.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  FlaskConical,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { exchangeNames } from "@/lib/market-types";
import { SignalAlerts } from "./signal-alerts";
import { useResearch } from "./provider";
const disclaimer =
  "仅供研究学习，不构成任何投资建议。历史表现不代表未来结果，交易有风险，请谨慎决策。";
const links = [
  { href: "/", title: "信号仪表盘", icon: LayoutDashboard },
  { href: "/rules", title: "规则与参数", icon: Settings2 },
  { href: "/backtest", title: "策略回测", icon: ChartNoAxesCombined },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { marketMode, market, exchange } = useResearch();
  const statusLabel =
    marketMode === "simulated"
      ? "模拟演示环境"
      : market.healthy
        ? `${exchangeNames[exchange]}行情已连接`
        : `${exchangeNames[exchange]}行情连接中或暂停`;
  return (
    <>
      <div className="risk-banner">
        <ShieldCheck size={13} className="shrink-0" />
        <span>{disclaimer}</span>
        <span className="ml-auto hidden whitespace-nowrap text-[#c5ad79] md:block">
          RESEARCH ONLY
        </span>
      </div>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <div className="brand-icon">
            <Activity size={23} />
          </div>
          <span>
            十分钟<span className="ml-2 text-primary">SIGNAL</span>
            <small>短周期信号研究工作台</small>
          </span>
        </Link>
        <div className="mt-12 px-4 text-[10px] tracking-[.18em] text-muted">
          WORKSPACE / 研究空间
        </div>
        <nav className="mt-4 space-y-2">
          {links.map(({ href, title, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn("nav-link", path === href && "active")}
            >
              <Icon size={17} />
              {title}
              {path === href && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <FlaskConical size={19} className="mb-3 text-primary" />
          <p className="text-sm text-foreground">从数据到判断</p>
          <p className="mt-2 text-xs leading-6 text-muted">
            用规则过滤噪声，
            <br />
            用回测检验假设。
          </p>
          <div className="mt-5 flex items-center gap-2 text-[10px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {statusLabel} <ArrowUpRight size={12} />
          </div>
        </div>
        <div className="sidebar-bottom">
          SIGNAL LAB <span>v1.0</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="hidden sm:inline">研究空间</span>
            <span className="hidden sm:inline text-border">/</span>
            <span className="text-foreground">
              {links.find((l) => l.href === path)?.title ?? "信号研究"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {statusLabel}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white/5 text-[10px]">
              SL
            </span>
          </div>
        </header>
        <nav className="mobile-nav">
          {links.map((l) => (
            <Link
              className={cn(path === l.href && "text-primary")}
              key={l.href}
              href={l.href}
            >
              {l.title}
            </Link>
          ))}
        </nav>
        <main>
          <SignalAlerts />
          {children}
        </main>
        <footer>
          <p className="w-full rounded-lg border border-[#453921] bg-[#272219] p-3 text-[11px] leading-6 text-[#d0b888]">
            {disclaimer}
          </p>
          <span>© 2026 SIGNAL LAB · 研究与教育用途</span>
          <span>首页行情来源可切换；回测均为研究用途 · UTC+8</span>
        </footer>
      </div>
    </>
  );
}
```


### `components/provider.tsx`

```tsx
"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  defaults,
  type Params,
  type Candle,
  simulate,
  validateParams,
} from "@/lib/engine";
import { useExchangeMarket } from "@/lib/use-market";
import type { MarketSymbol, Exchange, CandleInterval } from "@/lib/binance";
const Context = createContext<{
  params: Params;
  marketMode: "live" | "simulated";
  setMarketMode: (mode: "live" | "simulated") => void;
  exchange: Exchange;
  setExchange: (exchange: Exchange) => void;
  chartInterval: CandleInterval;
  setChartInterval: (interval: CandleInterval) => void;
  chartMarket: ReturnType<typeof useExchangeMarket>;
  symbol: MarketSymbol;
  setSymbol: (symbol: MarketSymbol) => void;
  market: ReturnType<typeof useExchangeMarket>;
  save: (p: Params) => void;
  rows: ReturnType<typeof simulate>;
  regenerate: () => void;
  uploadedData: { name: string; rows: Candle[] } | null;
  setUploadedData: (data: { name: string; rows: Candle[] } | null) => void;
}>({
  params: defaults,
  marketMode: "live",
  setMarketMode: () => {},
  exchange: "binance",
  setExchange: () => {},
  chartInterval: "1m",
  setChartInterval: () => {},
  chartMarket: {
    snapshot: null,
    healthy: false,
    ageMs: Infinity,
    loading: false,
    error: null,
    receivedAt: 0,
    retrySeconds: 0,
    refresh: () => {},
  },
  symbol: "BTCUSDT",
  setSymbol: () => {},
  market: {
    snapshot: null,
    healthy: false,
    ageMs: Infinity,
    loading: false,
    error: null,
    receivedAt: 0,
    retrySeconds: 0,
    refresh: () => {},
  },
  save: () => {},
  rows: simulate(),
  regenerate: () => {},
  uploadedData: null,
  setUploadedData: () => {},
});
export function ResearchProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState(defaults);
  const [marketMode, setMarketMode] = useState<"live" | "simulated">("live");
  const [symbol, setSymbol] = useState<MarketSymbol>("BTCUSDT");
  const [exchange, setExchange] = useState<Exchange>("binance");
  const [chartInterval, setChartInterval] = useState<CandleInterval>("1m");
  const market = useExchangeMarket(symbol, marketMode === "live", exchange);
  const chartMarket = useExchangeMarket(
    symbol,
    marketMode === "live" && chartInterval !== "1m",
    exchange,
    chartInterval,
  );
  const [uploadedData, setUploadedData] = useState<{
    name: string;
    rows: Candle[];
  } | null>(null);
  const [seed, setSeed] = useState(42);
  const [rows, setRows] = useState(() => simulate());
  function regenerate() {
    const next = seed + 1;
    setSeed(next);
    setRows(simulate(next));
  }
  useEffect(() => {
    try {
      const s = localStorage.getItem("signal-params-v1");
      if (s) {
        const p = { ...defaults, ...JSON.parse(s) };
        if (!validateParams(p)) setParams(p);
      }
    } catch {}
  }, []);
  const save = useCallback((p: Params) => {
    if (validateParams(p)) return;
    setParams(p);
    try {
      localStorage.setItem("signal-params-v1", JSON.stringify(p));
    } catch {}
  }, []);
  return (
    <Context.Provider
      value={{
        params,
        save,
        rows,
        regenerate,
        uploadedData,
        setUploadedData,
        marketMode,
        setMarketMode,
        symbol,
        setSymbol,
        exchange,
        setExchange,
        chartInterval,
        setChartInterval,
        chartMarket,
        market,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useResearch = () => useContext(Context);
```


### `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
:root {
  color-scheme: dark;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: #090c10;
  color: #e8edf4;
  font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 14px;
}
button,
a,
input {
  -webkit-tap-highlight-color: transparent;
}
button {
  cursor: pointer;
}
a {
  text-decoration: none;
  color: inherit;
}
::selection {
  background: #c8f27740;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid #c8f277;
  outline-offset: 4px;
}
input[type="range"] {
  accent-color: #c8f277;
  width: 100%;
  height: 4px;
}
.risk-banner {
  position: fixed;
  inset: 0 0 auto;
  min-height: 33px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 25px;
  background: #272219;
  color: #d0b888;
  font-size: 10px;
  letter-spacing: 0.03em;
  border-bottom: 1px solid #453921;
}
.sidebar {
  position: fixed;
  top: 33px;
  bottom: 0;
  left: 0;
  width: 226px;
  background: #0d1117;
  border-right: 1px solid #202630;
  padding: 30px 16px;
  display: flex;
  flex-direction: column;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.brand-icon {
  background: #c8f277;
  color: #17200d;
  border-radius: 9px;
  padding: 7px;
}
.brand small {
  display: block;
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #7f8a9a;
  font-weight: 400;
  margin-top: 7px;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 15px;
  border-radius: 7px;
  color: #8d99ac;
  font-size: 12px;
}
.nav-link:hover {
  background: #161d25;
}
.nav-link.active {
  background: #c8f2770d;
  color: #c8f277;
  border: 1px solid #c8f27720;
}
.sidebar-note {
  margin: auto 9px 25px;
  border: 1px solid #242d32;
  border-radius: 10px;
  padding: 18px;
  background: linear-gradient(135deg, #17201a70, transparent);
}
.sidebar-bottom {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #657083;
  padding: 12px 10px 0;
  border-top: 1px solid #202630;
}
.workspace {
  margin-left: 226px;
  padding-top: 33px;
  min-height: 100vh;
}
.topbar {
  height: 66px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 34px;
  border-bottom: 1px solid #202630;
}
.workspace main {
  padding: 33px 34px 20px;
  max-width: 1600px;
  margin: auto;
}
footer {
  max-width: 1600px;
  margin: auto;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 20px 34px 24px;
  font-size: 10px;
  color: #687386;
}
.mobile-nav {
  display: none;
}
.eyebrow {
  font-size: 10px;
  color: #a2b08c;
  letter-spacing: 0.18em;
  margin-bottom: 10px;
}
.page-title {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.04em;
  margin: 0;
}
.page-desc {
  color: #8d99ac;
  font-size: 12px;
  line-height: 1.8;
  margin-top: 9px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}
.metric-label {
  font-size: 11px;
  color: #8d99ac;
}
.metric-value {
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.05em;
  font-variant-numeric: tabular-nums;
  margin-top: 14px;
}
.data-label {
  font-size: 9px;
  letter-spacing: 0.05em;
  color: #687386;
}
.chart-box {
  height: 270px;
  width: 100%;
  position: relative;
}
.chart-watermark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #8d99ac08;
  pointer-events: none;
}
.signal-bullish {
  color: #96dfa9;
}
.signal-bearish {
  color: #f29699;
}
.signal-neutral {
  color: #a1abba;
}
.table-scroll {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
  text-align: left;
  font-size: 11px;
}
th {
  font-size: 10px;
  font-weight: 400;
  color: #8d99ac;
  padding: 13px 18px;
  background: #ffffff02;
  border-block: 1px solid #252c37;
}
td {
  padding: 14px 18px;
  border-bottom: 1px solid #ffffff06;
  font-variant-numeric: tabular-nums;
}
tbody tr:hover {
  background: #ffffff02;
}
.chart-tooltip {
  background: #151c26 !important;
  border: 1px solid #303947 !important;
  border-radius: 8px;
  color: #e8edf4 !important;
  font-size: 11px;
}
.status-dot {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  display: inline-block;
  margin-right: 7px;
}
.recharts-text {
  font-family: Arial, sans-serif;
}
@media (min-width: 1600px) {
  .workspace main {
    padding-top: 44px;
  }
}
@media (max-width: 1100px) {
  .sidebar {
    width: 196px;
  }
  .workspace {
    margin-left: 196px;
  }
  .brand {
    font-size: 14px;
  }
  .workspace main {
    padding: 25px 24px;
  }
  .topbar {
    padding: 0 24px;
  }
}
@media (max-width: 767px) {
  .sidebar {
    display: none;
  }
  .workspace {
    margin-left: 0;
    padding-top: 49px;
  }
  .risk-banner {
    min-height: 49px;
    font-size: 10px;
    padding: 8px 16px;
    line-height: 1.6;
  }
  .topbar {
    height: 55px;
    padding: 0 18px;
  }
  .mobile-nav {
    display: flex;
    gap: 25px;
    justify-content: center;
    border-bottom: 1px solid #252c37;
    padding: 13px 10px;
    font-size: 12px;
    color: #8d99ac;
  }
  .workspace main {
    padding: 25px 16px 10px;
  }
  .page-title {
    font-size: 23px;
  }
  .section-heading {
    align-items: flex-start;
  }
  .chart-box {
    height: 230px;
  }
  footer {
    padding: 20px 16px;
    font-size: 9px;
  }
  .metric-value {
    font-size: 23px;
  }
  td,
  th {
    padding: 12px;
  }
  .page-desc {
    font-size: 11px;
  }
}

/* Reserve the fixed notice height, including narrow-screen wrapped text. */
:root {
  --risk-height: 49px;
}
.risk-banner {
  height: var(--risk-height);
  font-size: 11px;
  line-height: 1.6;
}
.sidebar {
  top: var(--risk-height);
}
.workspace {
  padding-top: var(--risk-height);
}
@media (max-width: 767px) {
  :root {
    --risk-height: 72px;
  }
  .risk-banner {
    font-size: 11px;
  }
}
```


### `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";
export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#090c10",
        foreground: "#e8edf4",
        card: "#11161e",
        border: "#252c37",
        muted: "#8d99ac",
        primary: "#c8f277",
        positive: "#96dfa9",
        negative: "#f29699",
      },
      borderRadius: { xl: "16px" },
      fontFamily: {
        sans: ["Arial", "PingFang SC", "Microsoft YaHei", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```


### `postcss.config.js`

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```


### `next.config.mjs`

```js
const nextConfig = { experimental: { cpus: 2 } };
export default nextConfig;
```


### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```


### `components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": false
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib"
  }
}
```


### `lib/utils.ts`

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const price = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
```


### `components/ui/button.tsx`

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-[#17200d] hover:bg-[#d5ff8d]",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-white/5",
        ghost: "hover:bg-white/5 text-muted hover:text-foreground",
      },
      size: { default: "h-10 px-4", sm: "h-8 px-3 text-xs", icon: "h-10 w-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variants> {
  asChild?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(variants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
```


### `components/ui/card.tsx`

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card", className)}
      {...props}
    />
  );
}
export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pb-3", className)} {...props} />;
}
export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-sm font-medium", className)} {...props} />;
}
export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}
```


### `components/ui/badge.tsx`

```tsx
import { cn } from "@/lib/utils";
export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted",
        className,
      )}
      {...props}
    />
  );
}
```


### `components/ui/input.tsx`

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
```


### `components/ui/switch.tsx`

```tsx
"use client";
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-[#394250] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
```

## 4. 仪表盘首页完整代码

大号三态信号、过滤条件、可切换币安/OKX 的已收盘价格（模拟需手动切换）、Recharts OHLC 蜡烛图和最近 20 条触发信号。数据量不足时仅展示实际存在的信号；不伪造历史条数。过滤条件计数是规则满足情况，不是预测概率。


### `app/page.tsx`

```tsx
"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  Clock3,
  Download,
  Layers3,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Minus,
  X,
} from "lucide-react";
import { useResearch } from "@/components/provider";
import {
  analyze,
  backtest,
  displayDate,
  displayTime,
  labels,
  type Candle,
  ema,
} from "@/lib/engine";
import {
  TIMEFRAMES,
  intervalLabel,
  isCandleInterval,
  exchangeNames,
} from "@/lib/market-types";
import { simulatedChartRows } from "@/lib/chart-data";
import { price, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketControls } from "@/components/market-controls";
import { PriceChart } from "@/components/charts";
export default function Dashboard() {
  const { rows: simulatedRows, marketMode, market, exchange } = useResearch();
  const rows =
    marketMode === "live" ? (market.snapshot?.candles ?? []) : simulatedRows;
  if (!rows.length)
    return (
      <>
        <section className="section-heading">
          <div>
            <div className="eyebrow">MARKET / 交易所公开行情</div>
            <h1 className="page-title">10 分钟方向研究</h1>
            <p className="page-desc">
              选择 BTC 或 ETH，使用真实已收盘 K 线计算研究信号。
            </p>
          </div>
        </section>
        <MarketControls />
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-3xl text-muted">
              {market.loading ? "正在加载行情" : "实时信号暂停"}
            </h2>
            <p className="mt-4 text-xs text-muted">
              尚无可验证的交易所行情，不显示价格、方向建议或胜率。可等待自动重试，或明确选择模拟数据练习。
            </p>
          </CardContent>
        </Card>
      </>
    );
  return <DashboardContent rows={rows} />;
}
function DashboardContent({ rows }: { rows: Candle[] }) {
  const {
    params,
    regenerate,
    marketMode,
    symbol,
    market,
    exchange,
    chartInterval,
    setChartInterval,
    chartMarket,
  } = useResearch();
  const exchangeName = exchangeNames[exchange];
  const live = marketMode === "live";
  const paused = live && !market.healthy;
  const sourceLabel = live ? `${exchangeName}行情 · 研究用途` : "模拟数据";
  const [range, setRange] = useState(60);
  const [showEma, setShowEma] = useState(true);
  const [notice, setNotice] = useState("");
  const signals = useMemo(() => analyze(rows, params), [rows, params]);
  const stats = useMemo(() => backtest(rows, params), [rows, params]);
  const latest = signals[signals.length - 1];
  const current = paused
    ? { ...latest, direction: "neutral" as const, filters: [] }
    : latest;
  const lastSignalTime = latest.time;
  const last = rows[rows.length - 1],
    prior = rows[rows.length - 61];
  const change = (last.close / prior.close - 1) * 100;
  const recent = signals
    .map((s, i) => ({ ...s, index: i }))
    .filter((s) => s.direction !== "neutral")
    .slice(-20)
    .reverse();
  const selectedMarket = chartInterval === "1m" ? market : chartMarket;
  const chartRows = live
    ? (selectedMarket.snapshot?.candles ?? [])
    : simulatedChartRows(rows, chartInterval);
  const chartFast = ema(
      chartRows.map((r) => r.close),
      params.fast,
    ),
    chartSlow = ema(
      chartRows.map((r) => r.close),
      params.slow,
    );
  const visibleRows = chartRows.slice(-range);
  const chart = visibleRows.map((r, i) => ({
    ...r,
    time: r.datetime,
    price: r.close,
    fast: chartFast[chartRows.length - visibleRows.length + i],
    slow: chartSlow[chartRows.length - visibleRows.length + i],
  }));
  const Icon =
    current.direction === "bullish"
      ? TrendingUp
      : current.direction === "bearish"
        ? TrendingDown
        : Minus;
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            source: sourceLabel,
            symbol: live ? symbol : "SIMULATED_BTCUSDT",
            paused,
            params,
            signal: paused ? null : current,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "signal-research.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("研究信号快照已导出");
  }
  return (
    <>
      <section className="section-heading">
        <div>
          <div className="eyebrow">MARKET SIGNAL / 短周期研究</div>
          <h1 className="page-title">
            捕捉趋势，保持理性<span className="text-primary">。</span>
          </h1>
          <p className="page-desc">
            以多重技术指标过滤市场噪声，探索未来 10 分钟的方向假设。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={download}
          className="mt-5 hidden sm:inline-flex"
        >
          <Download size={13} />
          导出快照
        </Button>
      </section>
      <MarketControls />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f8a63c] text-lg font-bold text-[#3b2205]">
            {live && symbol === "ETHUSDT" ? "Ξ" : "₿"}
          </div>
          <span className="font-semibold tracking-wide">
            {live ? symbol.replace("USDT", "") : "BTC"}{" "}
            <span className="text-muted">/ USDT</span>
          </span>
          <Badge>{sourceLabel}</Badge>
          <span className="hidden text-[11px] text-muted sm:inline">
            1 分钟 K 线 · 10 分钟观察窗
          </span>
        </div>
        <span className="flex items-center gap-2 text-[10px] text-muted">
          <Clock3 size={12} />
          {live ? "最近收盘" : "样本时间"}{" "}
          {displayDate(live ? lastSignalTime : last.datetime)}{" "}
          {displayTime(live ? lastSignalTime : last.datetime)} UTC+8
        </span>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: live ? `${exchangeName}最近收盘价` : "最新模拟价格",
            value: `$${price(last.close)}`,
            sub: `近 60 分钟 ${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
            color: change >= 0 ? "text-positive" : "text-negative",
          },
          {
            label: "方向命中率",
            value: stats.total ? `${stats.winRate.toFixed(1)}%` : "—",
            sub: `${stats.total} 次非重叠研究样本`,
            color: "text-muted",
          },
          {
            label: "样本触发信号",
            value: String(
              signals.filter((s) => s.direction !== "neutral").length,
            ).padStart(2, "0"),
            sub: params.trendEnabled
              ? "四项过滤条件共同确认"
              : "趋势过滤关闭 · 三项条件确认",
            color: "text-muted",
          },
          {
            label: "信号观察周期",
            value: "10 分钟",
            sub: "1m 触发 / 5m 趋势过滤",
            color: "text-muted",
          },
        ].map((m, i) => (
          <Card key={m.label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <p className="metric-label">{m.label}</p>
                <span className="data-label">
                  {live ? "研究用途" : "模拟数据"}
                </span>
              </div>
              <div className="metric-value">{m.value}</div>
              <div
                className={cn(
                  "mt-3 flex items-center gap-1 text-[10px]",
                  m.color,
                )}
              >
                {i === 0 &&
                  (change >= 0 ? (
                    <ArrowUpRight size={13} />
                  ) : (
                    <ArrowDownRight size={13} />
                  ))}
                {m.sub}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-2 min-w-0 space-y-5 xl:order-1">
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle>{intervalLabel(chartInterval)} K 线</CardTitle>
                  <Badge>{sourceLabel}</Badge>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted">
                  K 线周期
                  <select
                    aria-label="K线周期"
                    value={chartInterval}
                    onChange={(e) => {
                      if (isCandleInterval(e.target.value))
                        setChartInterval(e.target.value);
                    }}
                    className="h-8 rounded-lg border border-border bg-background px-2 text-foreground"
                  >
                    {TIMEFRAMES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-1 rounded-md bg-background p-1">
                  {[30, 60, 180].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRange(n)}
                      className={cn(
                        "rounded px-3 py-1 text-[10px] text-muted",
                        range === n && "bg-[#283125] text-primary",
                      )}
                    >
                      {`${n} 根`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-2xl font-medium tabular-nums">
                  {chartRows.length ? price(chartRows.at(-1)!.close) : "—"}
                </span>
                <span className="text-[10px] text-muted">USDT</span>
                <span className="text-[10px] text-muted">
                  所选周期最近收盘价
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="mb-3 px-3 text-[10px] leading-5 text-muted">
                图表周期可独立切换；信号始终使用 1 分钟触发、5 分钟趋势和 10
                分钟观察窗。10 分钟 K 线由两根完整的 5 分钟 K 线合成；日线按 UTC
                对齐。
              </p>
              {live && selectedMarket.error && (
                <p role="alert" className="px-3 py-2 text-xs text-negative">
                  图表数据：{selectedMarket.error}
                </p>
              )}
              {live && !selectedMarket.healthy && chart.length > 0 && (
                <p className="px-3 text-xs text-[#d0b888]">
                  当前周期仅显示历史快照，等待更新。
                </p>
              )}
              {chart.length ? (
                <PriceChart
                  data={chart}
                  showEma={showEma}
                  sourceLabel={sourceLabel}
                  interval={chartInterval}
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-xs text-muted">
                  {selectedMarket.loading
                    ? "正在加载所选周期 K 线…"
                    : "该周期暂无有效行情"}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-3">
                <div className="flex gap-4 text-[10px] text-muted">
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-primary" />
                    {live ? `${exchangeName} K 线` : "模拟 K 线"}
                  </span>
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-[#76aee7]" />
                    图表 EMA {params.fast}
                  </span>
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-[#a79bd3]" />
                    图表 EMA {params.slow}
                  </span>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[10px] text-muted">
                  <input
                    type="checkbox"
                    checked={showEma}
                    onChange={(e) => setShowEma(e.target.checked)}
                    className="accent-primary"
                  />
                  显示均线
                </label>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle>最近 20 条信号</CardTitle>
                  <Badge>研究用途</Badge>
                </div>
                <Link
                  href="/backtest"
                  className="flex items-center gap-1 text-[10px] text-muted hover:text-primary"
                >
                  查看回测 <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <div className="table-scroll max-h-[390px]">
              <table>
                <thead className="sticky top-0 z-10 bg-card">
                  <tr>
                    <th>触发时间 UTC+8</th>
                    <th>信号方向</th>
                    <th>参考价格</th>
                    <th>RSI ({params.rsi})</th>
                    <th>成交量倍数</th>
                    <th>观察窗</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.time}>
                      <td className="text-muted">
                        {displayDate(s.time)} {displayTime(s.time)}
                      </td>
                      <td className={`signal-${s.direction}`}>
                        <span className="status-dot" />
                        {labels[s.direction]}
                      </td>
                      <td>{price(rows[s.index].close)}</td>
                      <td className="text-muted">{s.rsi.toFixed(1)}</td>
                      <td className="text-muted">
                        {s.volumeRatio.toFixed(2)}×
                      </td>
                      <td className="text-muted">10 分钟</td>
                    </tr>
                  ))}
                  {!recent.length && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted">
                        当前参数下暂无触发信号，可以前往规则页调整参数。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-[9px] text-muted">
              {live
                ? `仅展示${exchangeName}历史已收盘数据触发的研究信号；连接异常时保留历史快照，不代表当前可交易。`
                : "仅展示收盘时触发的历史模拟信号，不代表实际成交或未来收益。"}
            </p>
          </Card>
        </div>
        <div className="order-1 space-y-5 xl:order-2">
          <Card
            className={cn(
              "overflow-hidden",
              current.direction === "bullish"
                ? "border-[#96dfa940]"
                : current.direction === "bearish"
                  ? "border-[#f2969940]"
                  : "border-[#72809640]",
            )}
          >
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>当前方向信号</CardTitle>
                <Badge className="border-0 bg-white/5">
                  {paused ? "暂停" : sourceLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "my-5 flex items-center gap-4",
                  `signal-${current.direction}`,
                )}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-current/20 bg-white/[.03]">
                  <Icon size={34} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-[35px] font-semibold tracking-tight">
                    {paused ? "暂停" : labels[current.direction]}
                  </div>
                  <div className="mt-1 text-[9px] tracking-[.18em]">
                    {paused
                      ? "DATA UNAVAILABLE"
                      : current.direction === "neutral"
                        ? "WAIT FOR CONFIRMATION"
                        : current.direction === "bullish"
                          ? "BULLISH SIGNAL"
                          : "BEARISH SIGNAL"}
                  </div>
                </div>
              </div>
              <p className="text-[11px] leading-6 text-muted">
                {paused
                  ? "行情连接异常或数据已过期，暂停当前研究信号。下方图表仅为最后成功获取的历史数据。"
                  : current.direction === "neutral"
                    ? "过滤条件尚未全部满足，等待趋势与交叉形成共振。保持观望也是研究的一部分。"
                    : params.trendEnabled
                      ? "趋势方向与均线交叉一致，RSI 和成交量过滤均已通过。下一根开盘起观察 10 分钟。"
                      : "趋势过滤已关闭；均线交叉、RSI 和成交量过滤通过。下一根开盘起观察 10 分钟。"}
              </p>
              <div className="my-5 border-t border-border" />
              <div className="mb-4 flex justify-between text-[10px]">
                <span className="text-muted">
                  过滤条件{live ? ` · 收盘 ${displayTime(lastSignalTime)}` : ""}
                </span>
                <span>
                  {
                    current.filters.filter((f) => f.enabled !== false && f.pass)
                      .length
                  }{" "}
                  / {current.filters.filter((f) => f.enabled !== false).length}{" "}
                  {paused ? "信号已暂停" : "已满足"}
                </span>
              </div>
              <div className="space-y-4">
                {current.filters.map((f) => (
                  <div className="flex items-start gap-2.5" key={f.name}>
                    <span
                      className={cn(
                        "mt-0.5 rounded-full p-0.5",
                        f.enabled !== false && f.pass
                          ? "bg-positive/10 text-positive"
                          : "bg-white/5 text-muted",
                      )}
                    >
                      {f.enabled !== false && f.pass ? (
                        <Check size={11} />
                      ) : (
                        <Minus size={11} />
                      )}
                    </span>
                    <div>
                      <div className="text-[11px]">{f.name}</div>
                      <div className="mt-1 text-[9px] leading-4 text-muted">
                        {f.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                className="mt-6 w-full text-xs"
                disabled={live && (market.loading || market.retrySeconds > 0)}
                onClick={() => {
                  if (live) market.refresh();
                  else {
                    regenerate();
                    setNotice("已重新生成一组模拟行情，并重新计算信号");
                  }
                }}
              >
                <RefreshCw size={13} />
                {live ? "刷新交易所行情" : "重新生成模拟行情"}
              </Button>
              <Link
                href="/rules"
                className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted hover:text-primary"
              >
                <Settings2 size={11} />
                调整信号参数 <ArrowRight size={11} />
              </Link>
            </CardContent>
          </Card>
          <Card className="bg-transparent">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-[11px]">
                <ShieldCheck size={15} className="text-primary" />
                研究者须知
              </div>
              <p className="mt-3 text-[10px] leading-6 text-muted">
                信号是对规则的可视化表达，并非确定性预测。模拟回测未计手续费、滑点及杠杆成本。
              </p>
              <div className="mt-4 flex items-center gap-1 text-[9px] text-muted">
                <Layers3 size={11} />
                严格过滤 · 收盘确认 · 无前视数据
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex max-w-[90vw] items-center gap-4 rounded-lg border border-border bg-card p-4 text-xs shadow-xl"
        >
          <Check size={15} className="text-primary" />
          {notice}
          <button aria-label="关闭通知" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
```


### `components/charts.tsx`

```tsx
"use client";
import {
  Area,
  Bar,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { intervalMs, type CandleInterval } from "@/lib/market-types";
import { displayTime } from "@/lib/engine";
export type CandleChartPoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  fast: number;
  slow: number;
};
type CandleShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: CandleChartPoint;
};
function CandleShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
}: CandleShapeProps) {
  if (!payload) return <g />;
  const { open, high, low, close } = payload;
  const span = high - low || 1;
  const color = close >= open ? "#96dfa9" : "#f29699";
  const bodyTop = y + ((high - Math.max(open, close)) / span) * height;
  const bodyHeight = Math.max(1, (Math.abs(open - close) / span) * height);
  return (
    <g>
      <line
        x1={x + width / 2}
        x2={x + width / 2}
        y1={y}
        y2={y + height}
        stroke={color}
      />
      <rect
        x={x}
        y={bodyTop}
        width={Math.max(1, width)}
        height={bodyHeight}
        fill={color}
        rx={0.5}
      />
    </g>
  );
}
export function PriceChart({
  data,
  showEma = true,
  sourceLabel = "模拟数据",
  interval = "1m",
}: {
  data: CandleChartPoint[];
  showEma?: boolean;
  sourceLabel?: string;
  interval?: CandleInterval;
}) {
  const tickTime = (time: string) =>
    intervalMs(interval) >= 86400000
      ? new Date(time).toLocaleDateString("zh-CN", {
          timeZone: "UTC",
          month: "2-digit",
          day: "2-digit",
        })
      : displayTime(time);
  const candles = data.map((row) => ({ ...row, wick: [row.low, row.high] }));
  return (
    <div
      className="chart-box"
      role="img"
      aria-label={`${sourceLabel} ${interval} OHLC 蜡烛 K 线和 EMA 均线图`}
    >
      <div className="chart-watermark">
        {sourceLabel === "模拟数据" ? "SIMULATED" : "RESEARCH"}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={candles}
          margin={{ top: 10, right: 4, left: -12, bottom: 0 }}
          barCategoryGap="25%"
        >
          <CartesianGrid
            stroke="#242b35"
            strokeDasharray="3 4"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tickFormatter={tickTime}
            tick={{ fill: "#768195", fontSize: 10 }}
            minTickGap={50}
            axisLine={false}
            tickLine={false}
            tickMargin={12}
          />
          <YAxis
            domain={["dataMin - 20", "dataMax + 20"]}
            tick={{ fill: "#768195", fontSize: 10 }}
            tickFormatter={(n) =>
              Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })
            }
            axisLine={false}
            tickLine={false}
            width={66}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as CandleChartPoint;
              return (
                <div className="rounded-lg border border-border bg-card p-3 text-[11px] shadow-lg">
                  <p className="mb-2 text-muted">
                    {new Date(String(label)).toLocaleString("zh-CN", {
                      timeZone: "Asia/Shanghai",
                      hour12: false,
                    })}{" "}
                    · {sourceLabel}
                  </p>
                  {[
                    ["开", row.open],
                    ["高", row.high],
                    ["低", row.low],
                    ["收", row.close],
                  ].map(([name, value]) => (
                    <p key={name} className="flex justify-between gap-6">
                      <span className="text-muted">{name}</span>
                      <span>{Number(value).toFixed(2)}</span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Bar
            dataKey="wick"
            name={sourceLabel === "模拟数据" ? "模拟 K 线" : "交易所 K 线"}
            isAnimationActive={false}
            shape={(props: unknown) => (
              <CandleShape {...(props as unknown as CandleShapeProps)} />
            )}
          />
          {showEma && (
            <>
              <Line
                name="快速 EMA"
                dataKey="fast"
                dot={false}
                stroke="#76aee7"
                strokeWidth={1.2}
                isAnimationActive={false}
              />
              <Line
                name="慢速 EMA"
                dataKey="slow"
                dot={false}
                stroke="#a79bd3"
                strokeWidth={1.2}
                isAnimationActive={false}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
export function EquityChart({
  data,
}: {
  data: { time: string; returnPct: number }[];
}) {
  return (
    <div className="chart-box" role="img" aria-label="研究回测累计收益曲线">
      <div className="chart-watermark">RESEARCH</div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8f277" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#c8f277" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#242b35"
            strokeDasharray="3 4"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tickFormatter={displayTime}
            tick={{ fill: "#768195", fontSize: 10 }}
            minTickGap={50}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(n) => `${Number(n).toFixed(1)}%`}
            tick={{ fill: "#768195", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#151c26",
              border: "1px solid #303947",
              borderRadius: 8,
              fontSize: 11,
            }}
            labelFormatter={(v) => displayTime(String(v)) + " · 研究用途"}
            formatter={(v: number) => [`${v.toFixed(3)}%`, "累计模拟收益"]}
          />
          <Area
            dataKey="returnPct"
            type="linear"
            stroke="#c8f277"
            strokeWidth={2}
            fill="url(#equityFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

## 5. 信号规则页完整代码

可调整 EMA、RSI、成交量及趋势开关；所有有效修改立即生效。趋势开启时要求价格与 EMA 交叉方向一致，关闭时不要求 5 分钟均线预热。


### `app/rules/page.tsx`

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useResearch } from "@/components/provider";
import {
  analyze,
  defaults,
  labels,
  validateParams,
  type Params,
} from "@/lib/engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
const fields: {
  key: Exclude<keyof Params, "trendEnabled">;
  name: string;
  min: number;
  max: number;
  step: number;
  note: string;
}[] = [
  {
    key: "trend",
    name: "5 分钟趋势 EMA 周期",
    min: 2,
    max: 100,
    step: 1,
    note: "仅使用已收盘的完整 5 分钟 K 线",
  },
  {
    key: "fast",
    name: "1 分钟快速 EMA 周期",
    min: 2,
    max: 50,
    step: 1,
    note: "捕捉短周期动量变化",
  },
  {
    key: "slow",
    name: "1 分钟慢速 EMA 周期",
    min: 3,
    max: 100,
    step: 1,
    note: "应大于快速均线周期",
  },
  {
    key: "rsi",
    name: "RSI 周期",
    min: 2,
    max: 50,
    step: 1,
    note: "使用 Wilder 平滑计算",
  },
  {
    key: "rsiMin",
    name: "RSI 合理区间下限",
    min: 0,
    max: 99,
    step: 1,
    note: "低于此值的信号将被过滤",
  },
  {
    key: "rsiMax",
    name: "RSI 合理区间上限",
    min: 1,
    max: 100,
    step: 1,
    note: "高于此值的信号将被过滤",
  },
  {
    key: "volumePeriod",
    name: "成交量均值周期",
    min: 2,
    max: 100,
    step: 1,
    note: "使用当前 K 线之前的均量，不含当前根",
  },
  {
    key: "volumeMultiplier",
    name: "成交量放大倍数",
    min: 0.5,
    max: 5,
    step: 0.1,
    note: "当前成交量须严格大于均量 × 此倍数",
  },
];
export default function Rules() {
  const { params, save, rows } = useResearch();
  const [draft, setDraft] = useState(params);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(params), [params]);
  const error = validateParams(draft);
  const signals = useMemo(
    () => (error ? [] : analyze(rows, draft)),
    [rows, draft, error],
  );
  const signal = signals.at(-1);
  function update(key: keyof Params, value: number | boolean) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (!validateParams(next)) {
      save(next);
      setSaved(true);
    } else setSaved(false);
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <div className="eyebrow">STRATEGY SETTINGS / 策略实验室</div>
          <h1 className="page-title">让每一个信号，有据可循。</h1>
          <p className="page-desc">
            有效参数会同时应用到首页币安研究信号；此页使用模拟数据预览规则变化。
          </p>
        </div>
        <Badge className="mt-5">研究用途</Badge>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-primary" />
              <CardTitle>信号参数</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4">
              <div>
                <label htmlFor="trend-enabled" className="text-xs">
                  启用 5 分钟趋势过滤
                </label>
                <p className="mt-2 text-[10px] text-muted">
                  关闭后仅使用 EMA 交叉、RSI 与成交量条件；有效参数立即应用。
                </p>
              </div>
              <Switch
                id="trend-enabled"
                checked={draft.trendEnabled}
                onCheckedChange={(value) => update("trendEnabled", value)}
              />
            </div>
            <div className="grid gap-x-8 gap-y-7 pt-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label htmlFor={f.key} className="text-xs">
                      {f.name}
                    </label>
                    <Input
                      id={f.key}
                      type="number"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={Number.isNaN(draft[f.key]) ? "" : draft[f.key]}
                      onChange={(e) =>
                        update(
                          f.key,
                          e.target.value === "" ? NaN : Number(e.target.value),
                        )
                      }
                      className="h-8 w-20 text-right"
                    />
                  </div>
                  <input
                    aria-label={`${f.name}滑块`}
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={Number.isFinite(draft[f.key]) ? draft[f.key] : f.min}
                    onChange={(e) => update(f.key, Number(e.target.value))}
                  />
                  <p className="mt-3 text-[10px] text-muted">{f.note}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-border pt-5">
              {error && (
                <p role="alert" className="mb-4 text-xs text-negative">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={!!error}
                  onClick={() => {
                    save(draft);
                    setSaved(true);
                  }}
                >
                  <Save size={14} />
                  确认当前参数
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraft(defaults);
                    save(defaults);
                    setSaved(true);
                  }}
                >
                  <RotateCcw size={14} />
                  恢复默认参数
                </Button>
                {saved && (
                  <span role="status" className="text-xs text-positive">
                    有效参数已自动应用并保存
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>模拟信号预览</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge>同一组固定模拟数据</Badge>
              <div
                className={`my-5 text-4xl font-semibold signal-${signal?.direction ?? "neutral"}`}
              >
                {signal ? labels[signal.direction] : "参数无效"}
              </div>
              <p className="text-xs leading-6 text-muted">
                当前参数在 1,440 根模拟 K 线中触发{" "}
                <span className="text-foreground">
                  {error
                    ? "—"
                    : signals.filter((s) => s.direction !== "neutral").length}
                </span>{" "}
                次信号。预览随参数变化即时重算，有效修改即时应用到其他页面。
              </p>
              <Button asChild variant="outline" className="mt-5 w-full">
                <Link href="/">
                  返回仪表盘 <ArrowRight size={14} />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>四层过滤机制</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-5 text-xs">
                {[
                  "5 分钟趋势：价格在已收盘 EMA 上方只看涨，下方只看跌；开关关闭时不限制方向。",
                  "1 分钟触发：快速 EMA 在当前收盘上穿或下穿慢速 EMA，方向须与趋势一致。",
                  "RSI 过滤：数值须在设置的上下限内（含边界）。",
                  "成交量确认：成交量须严格大于前 N 根均量 × 倍数。",
                ].map((s, i) => (
                  <li key={s} className="flex gap-3 leading-6 text-muted">
                    <span className="text-primary">0{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
```

## 6. 回测页核心代码

浏览器解析 CSV；下一根开盘进入、十根分钟 K 线后退出；仅统计完成观察窗、不重叠。零收益不算胜利、会中断连续亏损。本金耗尽时将模拟损失限制为剩余本金并停止后续交易；上传数据跨页保留，刷新后需重新上传。显示胜率、平均收益、连续亏损、累计收益、最大回撤和分页明细。未计交易成本。


### `app/backtest/page.tsx`

```tsx
"use client";
import { useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FlaskConical,
  UploadCloud,
} from "lucide-react";
import { useResearch } from "@/components/provider";
import { backtest, displayTime, labels, parseCsv } from "@/lib/engine";
import { price } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EquityChart } from "@/components/charts";
export default function Backtest() {
  const { params, rows: sample, uploadedData, setUploadedData } = useResearch();
  const rows = uploadedData?.rows ?? sample;
  const source = uploadedData?.name ?? "内置模拟数据";
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const result = useMemo(() => backtest(rows, params), [rows, params]);
  const pages = Math.max(1, Math.ceil(result.total / 10));
  const safePage = Math.min(page, pages - 1);
  const uploaded = uploadedData !== null;
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("文件不能超过 5 MB");
      return;
    }
    setBusy(true);
    try {
      const parsed = parseCsv(await file.text());
      setUploadedData({ name: file.name, rows: parsed });
      setPage(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法读取 CSV");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  function template() {
    const text =
      "datetime,open,high,low,close,volume\n" +
      sample
        .slice(0, 720)
        .map((r) =>
          [r.datetime, r.open, r.high, r.low, r.close, r.volume].join(","),
        )
        .join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "simulated-1m-ohlcv.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <section className="section-heading">
        <div>
          <div className="eyebrow">BACKTEST / 用数据检验假设</div>
          <h1 className="page-title">回看过去，理解不确定性。</h1>
          <p className="page-desc">
            在连续的 1 分钟 OHLCV 数据上检验当前规则，观察 10 分钟方向表现。
          </p>
        </div>
        <Badge className="mt-5">研究用途</Badge>
      </section>
      <Card className="mb-5">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-border bg-background p-3">
                <FileSpreadsheet size={23} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm">选择回测数据源</h2>
                <p className="mt-2 text-[10px] text-muted">
                  CSV · 连续 1 分钟 K 线 · 至少 120 行 · 最多 20,000 行 / 5 MB
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={input}
                id="csv-upload"
                aria-label="上传 OHLCV CSV 文件"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <Button variant="outline" onClick={template} size="sm">
                <Download size={13} />
                下载模拟示例
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUploadedData(null);
                  setPage(0);
                  setError("");
                }}
              >
                <FlaskConical size={13} />
                使用模拟数据
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <UploadCloud size={14} />
                {busy ? "校验中…" : "上传 CSV"}
              </Button>
            </div>
          </div>
          <p className="mt-5 break-words rounded-lg bg-background px-3 py-2 font-mono text-[10px] leading-5 text-muted">
            datetime, open, high, low, close, volume
            <br />
            时间示例：2026-11-10T00:00:00Z（必须含时区，按分钟对齐）
          </p>
          {error && (
            <p role="alert" className="mt-3 text-xs text-negative">
              {error}。已保留上一次有效数据。
            </p>
          )}
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-muted"
          >
            <Check size={12} className="text-positive" />
            <span className="max-w-xs truncate">{source}</span>
            <span>· {rows.length.toLocaleString()} 根 K 线</span>
            <Badge>{uploaded ? "用户上传 · 研究用途" : "模拟数据"}</Badge>
          </div>
        </CardContent>
      </Card>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-3">
        {[
          {
            title: "总交易次数",
            value: String(result.total),
            note: "不重叠的 10 分钟观察窗",
          },
          {
            title: "方向胜率",
            value: result.total ? `${result.winRate.toFixed(1)}%` : "—",
            note: "收益 > 0 的样本比例，持平计非胜",
          },
          {
            title: "平均每笔收益",
            value: result.total ? `${result.average.toFixed(3)}%` : "—",
            note: "无杠杆方向收益，不含交易成本",
          },
          {
            title: "最大连续亏损",
            value: result.total ? `${result.maxConsecutiveLosses} 笔` : "—",
            note: "连续负收益笔数，持平或盈利中断计数",
          },
          {
            title: "累计模拟收益",
            value: result.total ? `${result.returnPct.toFixed(3)}%` : "—",
            note: "初始模拟权益 10,000 · 全额复利",
          },
          {
            title: "最大回撤",
            value: result.total ? `${result.maxDrawdown.toFixed(3)}%` : "—",
            note: "按已平仓权益峰值计算",
          },
        ].map((m) => (
          <Card key={m.title}>
            <CardContent className="pt-4">
              <div className="flex justify-between">
                <span className="metric-label">{m.title}</span>
                <span className="data-label">研究用途</span>
              </div>
              <div className="metric-value">{m.value}</div>
              <p className="mt-3 text-[9px] text-muted">{m.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {result.capitalDepleted && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-negative/30 bg-negative/5 p-4 text-xs leading-6 text-negative"
        >
          模拟本金已耗尽，回测已停止。本笔计入的模拟损失以上笔剩余本金为限；不模拟真实保证金强平或债务。
        </p>
      )}
      <Card className="mb-5">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle>累计模拟收益曲线</CardTitle>
              <Badge>{uploaded ? "上传数据 · 研究用途" : "模拟数据"}</Badge>
            </div>
            <span
              className={
                result.returnPct >= 0 ? "text-positive" : "text-negative"
              }
            >
              {result.returnPct >= 0 ? "+" : ""}
              {result.returnPct.toFixed(3)}%{" "}
              <span className="text-[10px] text-muted">研究回测</span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {result.total ? (
            <EquityChart data={result.curve} />
          ) : (
            <div className="flex h-56 items-center justify-center text-xs text-muted">
              当前数据和参数下无可结算的交易。请增加样本长度或调整参数。
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex justify-between">
            <CardTitle>交易明细</CardTitle>
            <Badge>研究用途 · 非真实成交</Badge>
          </div>
        </CardHeader>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>入场日期 / UTC+8</th>
                <th>方向</th>
                <th>入场价格</th>
                <th>退出价格</th>
                <th>退出时间</th>
                <th>单笔收益</th>
                <th>模拟权益</th>
              </tr>
            </thead>
            <tbody>
              {result.trades
                .slice(safePage * 10, safePage * 10 + 10)
                .map((t) => (
                  <tr key={t.time}>
                    <td className="text-muted">
                      {new Date(t.time).toLocaleDateString("zh-CN", {
                        timeZone: "Asia/Shanghai",
                      })}{" "}
                      {displayTime(t.time)}
                    </td>
                    <td className={`signal-${t.direction}`}>
                      {labels[t.direction]}
                    </td>
                    <td>{price(t.entry)}</td>
                    <td>{price(t.exit)}</td>
                    <td className="text-muted">{displayTime(t.exitTime)}</td>
                    <td
                      className={
                        t.returnPct > 0
                          ? "text-positive"
                          : t.returnPct < 0
                            ? "text-negative"
                            : "text-muted"
                      }
                    >
                      {t.returnPct > 0 ? "+" : ""}
                      {t.returnPct.toFixed(3)}%
                      {t.capitalDepleted && (
                        <span
                          className="ml-2 text-[9px]"
                          title={`原始方向价格变化 ${t.rawReturnPct.toFixed(3)}%，按剩余本金限制模拟亏损`}
                        >
                          本金耗尽
                        </span>
                      )}
                    </td>
                    <td>{price(t.equity)}</td>
                  </tr>
                ))}
              {!result.total && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    暂无交易明细
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-4 text-[10px] text-muted">
          <span>
            共 {result.total} 笔 · 第 {safePage + 1} / {pages} 页
          </span>
          <div className="flex gap-2">
            <Button
              aria-label="上一页"
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft size={13} />
            </Button>
            <Button
              aria-label="下一页"
              variant="outline"
              size="sm"
              disabled={safePage >= pages - 1}
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      </Card>
      <div className="mt-5 rounded-xl border border-border p-5 text-[10px] leading-6 text-muted">
        <p className="mb-1 text-xs text-foreground">回测假设与边界</p>
        <p>
          信号在当前分钟收盘后确认；下一根开盘入场，第 10 根分钟 K
          线收盘退出。每次只持有一笔，不叠加仓位；不足 10
          分钟的尾部信号不结算。以初始 10,000
          模拟单位、全额复利计算权益，不使用杠杆。看涨收益为（退出价 / 入场价 −
          1），看跌取其相反数。
        </p>
        <p>
          未计手续费、滑点、资金费、流动性及交易执行约束；最大回撤仅基于已平仓权益，未反映持仓内波动。上传数据不会传往服务器，不会自动验证其真实性。跨页调整规则会保留上传数据；刷新页面后需重新上传。零交易不等于策略有效。模拟单笔亏损最多计入剩余本金，触及上限后权益归零并停止后续交易；未模拟持仓内强平路径或实际保证金债务。
        </p>
      </div>
    </>
  );
}
```

## 7. 模拟数据与简单信号计算逻辑

确定性模拟 OHLCV、EMA、Wilder RSI、完整 5 分钟聚合、成交量过滤、趋势开关、回测与严格 CSV 校验。币安与 OKX 公开行情通过服务端固定域名接口接入，客户端每 15 秒检查已收盘数据；其他行情源仍可扩展，当前不接账户或订单执行。


### `lib/engine.ts`

```ts
export type Candle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type Params = {
  trend: number;
  trendEnabled: boolean;
  fast: number;
  slow: number;
  rsi: number;
  rsiMin: number;
  rsiMax: number;
  volumePeriod: number;
  volumeMultiplier: number;
};
export const defaults: Params = {
  trend: 20,
  trendEnabled: true,
  fast: 3,
  slow: 8,
  rsi: 7,
  rsiMin: 30,
  rsiMax: 70,
  volumePeriod: 20,
  volumeMultiplier: 1.1,
};
export type Direction = "bullish" | "bearish" | "neutral";
export const labels: Record<Direction, string> = {
  bullish: "看涨",
  bearish: "看跌",
  neutral: "观望",
};
export type Filter = {
  name: string;
  detail: string;
  pass: boolean;
  enabled?: boolean;
};
export type Signal = {
  direction: Direction;
  filters: Filter[];
  rsi: number;
  volumeRatio: number;
  fast: number;
  slow: number;
  trend: number;
  time: string;
  ready: boolean;
};
export function validateParams(p: Params): string | null {
  if (typeof p.trendEnabled !== "boolean") return "趋势过滤开关必须为布尔值";
  const periods = [p.trend, p.fast, p.slow, p.rsi, p.volumePeriod];
  if (periods.some((n) => !Number.isInteger(n) || n < 2 || n > 100))
    return "指标周期必须为 2–100 的整数";
  if (p.fast >= p.slow) return "快速 EMA 周期必须小于慢速 EMA 周期";
  if (
    ![p.rsiMin, p.rsiMax, p.volumeMultiplier].every(Number.isFinite) ||
    p.rsiMin < 0 ||
    p.rsiMax > 100 ||
    p.rsiMin >= p.rsiMax
  )
    return "RSI 下限必须小于上限，且在 0–100 内";
  if (p.volumeMultiplier < 0.5 || p.volumeMultiplier > 5)
    return "成交量倍数须在 0.5–5 之间";
  return null;
}
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  return values.reduce<number[]>((a, v, i) => {
    a.push(i ? v * k + a[i - 1] * (1 - k) : v);
    return a;
  }, []);
}
export function rsi(values: number[], period: number): number[] {
  const result = new Array(values.length).fill(50);
  let gain = 0,
    loss = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (i <= period) {
      gain += Math.max(d, 0) / period;
      loss += Math.max(-d, 0) / period;
    } else {
      gain = (gain * (period - 1) + Math.max(d, 0)) / period;
      loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    }
    if (i >= period)
      result[i] =
        loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
  }
  return result;
}
export function simulate(seed = 42, count = 1440): Candle[] {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  let last = 67420;
  const start = Date.UTC(2026, 10, 10, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const open = last;
    const move = (random() - 0.5) * 94 + Math.sin(i / 23) * 9;
    const close = open + move;
    last = close;
    return {
      datetime: new Date(start + i * 60000).toISOString(),
      open,
      close,
      high: Math.max(open, close) + random() * 36,
      low: Math.min(open, close) - random() * 36,
      volume: 110 + random() * 190 + (Math.abs(move) > 35 ? 110 : 0),
    };
  });
}
// Only completed 5-minute bars are visible to a 1-minute decision.
export function analyze(rows: Candle[], p: Params = defaults): Signal[] {
  const error = validateParams(p);
  if (error) throw new Error(error);
  const closes = rows.map((r) => r.close),
    fast = ema(closes, p.fast),
    slow = ema(closes, p.slow),
    rs = rsi(closes, p.rsi);
  const groups = new Map<
    number,
    { last: number; count: number; end: number }
  >();
  rows.forEach((r, i) => {
    const key = Math.floor(Date.parse(r.datetime) / 300000);
    const g = groups.get(key);
    groups.set(key, { last: r.close, count: (g?.count ?? 0) + 1, end: i });
  });
  const completed = [...groups.entries()]
    .filter(
      ([key, g]) =>
        g.count === 5 &&
        Date.parse(rows[g.end].datetime) === key * 300000 + 240000,
    )
    .map(([, g]) => g);
  const trends = ema(
    completed.map((g) => g.last),
    p.trend,
  );
  let cursor = -1;
  return rows.map((row, i) => {
    while (cursor + 1 < completed.length && completed[cursor + 1].end <= i)
      cursor++;
    const t = cursor >= 0 ? trends[cursor] : 0;
    const up = cursor >= p.trend - 1 && row.close > t,
      down = cursor >= p.trend - 1 && row.close < t;
    const crossUp = i > 0 && fast[i] > slow[i] && fast[i - 1] <= slow[i - 1],
      crossDown = i > 0 && fast[i] < slow[i] && fast[i - 1] >= slow[i - 1];
    const avg =
      i >= p.volumePeriod
        ? rows.slice(i - p.volumePeriod, i).reduce((s, r) => s + r.volume, 0) /
          p.volumePeriod
        : 0;
    const ratio = avg ? row.volume / avg : 0,
      okRsi = rs[i] >= p.rsiMin && rs[i] <= p.rsiMax,
      okVol = ratio > p.volumeMultiplier;
    const momentumAligned = p.trendEnabled
      ? (up && crossUp) || (down && crossDown)
      : crossUp || crossDown;
    const momentumDetail =
      !crossUp && !crossDown
        ? "本根收盘未发生交叉"
        : p.trendEnabled && !momentumAligned
          ? `本根收盘${crossUp ? "上穿" : "下穿"}，但与趋势方向不一致或趋势尚未就绪`
          : `本根收盘发生${crossUp ? "上穿" : "下穿"}`;
    const ready =
      (!p.trendEnabled || cursor >= p.trend - 1) &&
      i >= Math.max(p.slow, p.rsi, p.volumePeriod);
    const direction: Direction =
      ready && (!p.trendEnabled || up) && crossUp && okRsi && okVol
        ? "bullish"
        : ready && (!p.trendEnabled || down) && crossDown && okRsi && okVol
          ? "bearish"
          : "neutral";
    return {
      direction,
      ready,
      rsi: rs[i],
      volumeRatio: ratio,
      fast: fast[i],
      slow: slow[i],
      trend: t,
      time: new Date(Date.parse(row.datetime) + 60000).toISOString(),
      filters: [
        {
          name: `5 分钟 EMA${p.trend} 趋势`,
          enabled: p.trendEnabled,
          detail: !p.trendEnabled
            ? "已关闭，不限制涨跌方向"
            : up
              ? "价格高于已收盘 5 分钟 EMA，只允许看涨"
              : down
                ? "价格低于已收盘 5 分钟 EMA，只允许看跌"
                : "趋势未形成或预热不足",
          pass: !p.trendEnabled || up || down,
        },
        {
          name: `1 分钟 EMA${p.fast} / EMA${p.slow}`,
          detail: ready ? momentumDetail : "指标预热不足，等待足够的 K 线",
          pass: ready && momentumAligned,
        },
        {
          name: `RSI(${p.rsi}) 区间过滤`,
          detail: `${rs[i].toFixed(1)} · 有效区间 ${p.rsiMin}–${p.rsiMax}`,
          pass: okRsi,
        },
        {
          name: "成交量确认",
          detail: `前 ${p.volumePeriod} 根均量的 ${ratio.toFixed(2)}× / 阈值 ${p.volumeMultiplier}×`,
          pass: okVol,
        },
      ],
    };
  });
}
export type Trade = {
  time: string;
  exitTime: string;
  direction: Direction;
  entry: number;
  exit: number;
  returnPct: number;
  rawReturnPct: number;
  capitalDepleted: boolean;
  equity: number;
};
export function backtest(rows: Candle[], p: Params = defaults) {
  const signals = analyze(rows, p);
  const trades: Trade[] = [];
  let equity = 10000,
    peak = equity,
    maxDrawdown = 0,
    lossStreak = 0,
    maxConsecutiveLosses = 0;
  const curve = [{ time: rows[0]?.datetime ?? "", equity, returnPct: 0 }];
  // Decision at closed candle i, entry at next open, exit after ten 1-minute bars. No overlapping trades.
  for (let i = 0; i + 10 < rows.length; i++) {
    const s = signals[i];
    if (s.direction === "neutral") continue;
    const entry = rows[i + 1].open,
      exit = rows[i + 10].close;
    const rawReturn = (exit / entry - 1) * (s.direction === "bullish" ? 1 : -1);
    // Limited-capital research model, not a simulation of margin liquidation.
    const ret = Math.max(-1, rawReturn);
    lossStreak = ret < 0 ? lossStreak + 1 : 0;
    maxConsecutiveLosses = Math.max(maxConsecutiveLosses, lossStreak);
    equity *= 1 + ret;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
    trades.push({
      time: rows[i + 1].datetime,
      exitTime: new Date(
        Date.parse(rows[i + 10].datetime) + 60000,
      ).toISOString(),
      direction: s.direction,
      entry,
      exit,
      returnPct: ret * 100,
      rawReturnPct: rawReturn * 100,
      capitalDepleted: equity === 0,
      equity,
    });
    curve.push({
      time: new Date(Date.parse(rows[i + 10].datetime) + 60000).toISOString(),
      equity,
      returnPct: (equity / 10000 - 1) * 100,
    });
    if (equity === 0) break;
    i += 9;
  }
  return {
    trades,
    curve,
    total: trades.length,
    winRate: trades.length
      ? (trades.filter((t) => t.returnPct > 0).length / trades.length) * 100
      : 0,
    average: trades.length
      ? trades.reduce((s, t) => s + t.returnPct, 0) / trades.length
      : 0,
    maxDrawdown,
    maxConsecutiveLosses,
    capitalDepleted: equity === 0,
    returnPct: (equity / 10000 - 1) * 100,
  };
}
// Validate calendar components before Date.parse, which otherwise normalizes Feb 30.
export function parseCandleTime(raw: string): number {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      raw,
    );
  if (!match) throw new Error("时间请使用含时区的 ISO 格式");
  const [, y, mo, d, h, mi, sec = "0", fraction = "0", , , zh = "0", zm = "0"] =
    match;
  const year = Number(y),
    month = Number(mo),
    day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    Number(h) > 23 ||
    Number(mi) > 59 ||
    Number(sec) !== 0 ||
    /[1-9]/.test(fraction) ||
    Number(zh) > 14 ||
    Number(zm) > 59 ||
    (Number(zh) === 14 && Number(zm) !== 0)
  )
    throw new Error("日历日期无效，或时间未按整分钟对齐");
  const time = Date.parse(raw);
  if (!Number.isFinite(time) || time % 60000 !== 0)
    throw new Error("时间无效或未按整分钟对齐");
  return time;
}
export function parseCsv(text: string): Candle[] {
  const lines = text
    .trim()
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV 至少需要表头和一行数据");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const fields = ["datetime", "open", "high", "low", "close", "volume"];
  if (fields.some((f) => !headers.includes(f)))
    throw new Error("缺少必要字段：datetime, open, high, low, close, volume");
  if (lines.length > 20001) throw new Error("最多支持 20,000 行数据");
  const rows = lines.slice(1).map((line, index) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const get = (f: string) => cells[headers.indexOf(f)];
    const raw = get("datetime");
    let time: number;
    try {
      time = parseCandleTime(raw);
    } catch (error) {
      throw new Error(
        `第 ${index + 2} 行：${error instanceof Error ? error.message : "时间无效"}`,
      );
    }
    const nums = fields
      .slice(1)
      .map((f) => (get(f) === "" ? NaN : Number(get(f))));
    const [open, high, low, close, volume] = nums;
    if (
      !Number.isFinite(time) ||
      time % 60000 !== 0 ||
      nums.some((n) => !Number.isFinite(n)) ||
      Math.min(open, high, low, close) <= 0 ||
      volume < 0 ||
      high < Math.max(open, close) ||
      low > Math.min(open, close) ||
      low > high
    )
      throw new Error(`第 ${index + 2} 行时间或 OHLCV 数据无效`);
    return {
      datetime: new Date(time).toISOString(),
      open,
      high,
      low,
      close,
      volume,
    };
  });
  for (let i = 1; i < rows.length; i++)
    if (
      Date.parse(rows[i].datetime) - Date.parse(rows[i - 1].datetime) !==
      60000
    )
      throw new Error(
        `第 ${i + 2} 行：请按时间升序提供连续的 1 分钟 K 线，不可重复或缺失`,
      );
  if (rows.length < 120)
    throw new Error("至少需要 120 根连续 1 分钟 K 线，用于趋势预热和回测");
  return rows;
}
export function displayTime(time: string) {
  return new Date(time).toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function displayDate(time: string) {
  return new Date(time).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
  });
}
```


### `lib/market-data.ts`

```ts
import { simulate, type Candle } from "./engine";

// Integration boundary for additional HTTP/WebSocket adapters: return continuous,
// validated 1-minute candles with ISO timezone-aware OPEN timestamps. Only closed
// candles should be passed to analyze(); never expose an unfinished 5m candle.
// Keep API credentials server-side in a Next.js route handler, not client bundles.
export interface MarketDataSource {
  readonly kind: "simulated" | "live";
  loadCandles(options: {
    symbol: string;
    limit: number;
    seed?: number;
  }): Promise<Candle[]>;
}
export const simulatedSource: MarketDataSource = {
  kind: "simulated",
  async loadCandles({ limit, seed = 42 }) {
    return simulate(seed, limit);
  },
};
// Binance and OKX have server adapters in binance.ts, okx.ts and /api/market.
// This interface remains available for other sources; production UI must always
// distinguish actual exchange data, retained historical snapshots, and simulations.
```

### `components/market-controls.tsx`

```tsx
"use client";
import { RefreshCw } from "lucide-react";
import { useResearch } from "./provider";
import { isMarketSymbol, isExchange, exchangeNames } from "@/lib/binance";
import { Button } from "./ui/button";
export function MarketControls() {
  const {
    symbol,
    setSymbol,
    marketMode,
    setMarketMode,
    market,
    exchange,
    setExchange,
  } = useResearch();
  const name = exchangeNames[exchange];
  return (
    <section
      aria-label="行情来源与连接状态"
      className="mb-5 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          交易所
          <select
            aria-label="交易所"
            value={exchange}
            disabled={marketMode === "simulated"}
            onChange={(e) => {
              if (isExchange(e.target.value)) setExchange(e.target.value);
            }}
            className="h-9 rounded-lg border border-border bg-background px-3 text-foreground"
          >
            <option value="binance">币安 Binance</option>
            <option value="okx">OKX</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          交易对
          <select
            aria-label="交易对"
            value={symbol}
            disabled={marketMode === "simulated"}
            onChange={(e) => {
              if (isMarketSymbol(e.target.value)) setSymbol(e.target.value);
            }}
            className="h-9 rounded-lg border border-border bg-background px-3 text-foreground"
          >
            <option value="BTCUSDT">BTC / USDT</option>
            <option value="ETHUSDT">ETH / USDT</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          数据源
          <select
            aria-label="数据源"
            value={marketMode}
            onChange={(e) =>
              setMarketMode(e.target.value === "live" ? "live" : "simulated")
            }
            className="h-9 rounded-lg border border-border bg-background px-3 text-foreground"
          >
            <option value="live">交易所实时行情</option>
            <option value="simulated">模拟数据（练习）</option>
          </select>
        </label>
        {marketMode === "live" && (
          <Button
            variant="outline"
            size="sm"
            disabled={market.loading || market.retrySeconds > 0}
            onClick={market.refresh}
          >
            <RefreshCw size={13} />
            {market.retrySeconds > 0
              ? `${market.retrySeconds}s 后重试`
              : market.loading
                ? "连接中…"
                : "刷新行情"}
          </Button>
        )}
        <span
          data-testid="market-status"
          className={`text-[11px] ${marketMode === "live" && !market.healthy ? "text-[#d0b888]" : "text-positive"}`}
        >
          {marketMode === "simulated"
            ? "模拟演示 · 非真实市场"
            : market.healthy
              ? `${name}已连接 · 研究用途`
              : market.loading
                ? `正在连接${name}，信号暂未启用`
                : "行情不可用 · 实时信号已暂停"}
        </span>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted">
        {marketMode === "simulated"
          ? "此模式仅用于练习；切换至交易所实时行情后才会请求真实市场数据。"
          : `每 15 秒检查一次，仅用已收盘的 1 分钟 K 线计算；价格为最近收盘价，不是逐笔报价。${market.receivedAt ? `最近更新 ${new Date(market.receivedAt).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}（UTC+8）。` : ""}`}
      </p>
      {marketMode === "live" && market.error && (
        <p role="alert" className="mt-2 text-xs leading-5 text-negative">
          {market.error}。不会自动改用模拟数据。
        </p>
      )}
      {marketMode === "live" &&
        market.snapshot &&
        !market.error &&
        !market.healthy &&
        !market.loading && (
          <p role="alert" className="mt-2 text-xs text-negative">
            行情超过 2 分钟未更新，实时信号已暂停。
          </p>
        )}
    </section>
  );
}
```

### `lib/binance.ts`

```ts
import type { Candle } from "./engine";

export * from "./market-types";
import {
  isMarketSymbol,
  intervalMs,
  validateMarketCandles,
  aggregateCandles,
  MarketError,
  type MarketSymbol,
  type MarketSnapshot,
  type CandleInterval,
} from "./market-types";
export function decodeBinanceKlines(
  value: unknown,
  serverTime: number,
  interval: CandleInterval = "1m",
): Candle[] {
  if (
    !Number.isSafeInteger(serverTime) ||
    serverTime <= 0 ||
    !Array.isArray(value)
  )
    throw new MarketError("币安行情响应格式无效");
  const candles: Candle[] = [];
  for (const raw of value) {
    if (!Array.isArray(raw) || raw.length < 7)
      throw new MarketError("币安 K 线格式无效");
    const [time, o, h, l, c, v, closeTime] = raw;
    if (
      !Number.isSafeInteger(time) ||
      time <= 0 ||
      time % intervalMs(interval) !== 0 ||
      closeTime !== time + intervalMs(interval) - 1
    )
      throw new MarketError("币安 K 线时间无效");
    if (closeTime >= serverTime) continue; // Never compute signals from an unfinished bar.
    const numbers = [o, h, l, c, v].map((n) =>
      typeof n === "number" || (typeof n === "string" && n.trim() !== "")
        ? Number(n)
        : NaN,
    );
    const [open, high, low, close, volume] = numbers;
    if (
      numbers.some((n) => !Number.isFinite(n)) ||
      Math.min(open, high, low, close) <= 0 ||
      volume < 0 ||
      high < Math.max(open, close) ||
      low > Math.min(open, close) ||
      low > high
    )
      throw new MarketError("币安 OHLCV 数值无效");
    candles.push({
      datetime: new Date(time).toISOString(),
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return validateMarketCandles(candles, serverTime, interval);
}

// Public market-data-only endpoint documented by Binance. No account or trading key.
// The hostname, interval and maximum count are fixed, and symbols are allowlisted.
export async function fetchBinanceMarket(
  symbol: MarketSymbol,
  fetcher: typeof fetch = fetch,
  interval: CandleInterval = "1m",
): Promise<Omit<MarketSnapshot, "ageMs">> {
  if (!isMarketSymbol(symbol))
    throw new MarketError("仅支持 BTCUSDT 和 ETHUSDT", 400);
  const get = async (path: string): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetcher(
        "https://data-api.binance.vision/api/v3/" + path,
        {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(8000),
        },
      );
    } catch {
      throw new MarketError("无法连接币安公开行情，请稍后重试；实时信号已暂停");
    }
    if (response.status === 429 || response.status === 418) {
      const retry = Number(response.headers.get("Retry-After"));
      throw new MarketError(
        "币安请求限流，等待后自动重试",
        429,
        Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) : 60,
      );
    }
    if (response.status === 451 || response.status === 403)
      throw new MarketError(
        "当前部署区域无法访问币安公开行情；实时信号已暂停",
        503,
        60,
      );
    if (!response.ok) throw new MarketError("币安行情服务暂时不可用", 502);
    try {
      return await response.json();
    } catch {
      throw new MarketError("币安行情返回了无效 JSON");
    }
  };
  const requestedAt = Date.now();
  const base = interval === "10m" ? "5m" : interval;
  const limit = interval === "1m" ? 1000 : interval === "10m" ? 404 : 202;
  const [clock, raw] = await Promise.all([
    get("time"),
    get(`klines?symbol=${symbol}&interval=${base}&limit=${limit}`),
  ]);
  const serverTime =
    typeof clock === "object" && clock !== null && "serverTime" in clock
      ? Number(clock.serverTime)
      : NaN;
  const decoded = decodeBinanceKlines(raw, serverTime, base);
  const candles =
    interval === "10m"
      ? validateMarketCandles(
          aggregateCandles(decoded, "10m", "5m"),
          serverTime,
          "10m",
        )
      : decoded;
  return {
    source: "binance",
    symbol,
    interval,
    candles,
    serverTime,
    fetchedAt: requestedAt,
  };
}
```

### `lib/use-market.ts`

```ts
"use client";
import { useEffect, useState } from "react";
import {
  validateMarketCandles,
  maxAgeForInterval,
  type Exchange,
  type CandleInterval,
  MARKET_POLL_MS,
  type MarketSnapshot,
  type MarketSymbol,
} from "./binance";

export function readMarketSnapshot(
  body: unknown,
  symbol: MarketSymbol,
  exchange: Exchange = "binance",
  interval: CandleInterval = "1m",
): MarketSnapshot {
  const data = body as MarketSnapshot;
  if (
    !data ||
    data.source !== exchange ||
    data.symbol !== symbol ||
    data.interval !== interval ||
    !Array.isArray(data.candles) ||
    !Number.isFinite(data.ageMs) ||
    data.ageMs < 0 ||
    data.ageMs > maxAgeForInterval(interval) ||
    !Number.isFinite(data.fetchedAt)
  )
    throw new Error("行情数据格式或时效无效，实时信号已暂停");
  const candles = validateMarketCandles(
    data.candles,
    data.serverTime,
    interval,
  );
  return { ...data, candles };
}
export function useExchangeMarket(
  symbol: MarketSymbol,
  enabled: boolean,
  exchange: Exchange = "binance",
  interval: CandleInterval = "1m",
) {
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [state, setState] = useState<{
    snapshot: MarketSnapshot | null;
    receivedAt: number;
    error: string | null;
    loading: boolean;
    retryAt: number;
  }>({
    snapshot: null,
    receivedAt: 0,
    error: null,
    loading: false,
    retryAt: 0,
  });
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setState((previous) =>
      previous.snapshot?.symbol === symbol &&
      previous.snapshot?.source === exchange &&
      previous.snapshot?.interval === interval
        ? { ...previous, loading: true }
        : {
            snapshot: null,
            receivedAt: 0,
            error: null,
            loading: true,
            retryAt: 0,
          },
    );
    async function load() {
      if (!active) return;
      let delay = MARKET_POLL_MS;
      setState((previous) => ({ ...previous, loading: true }));
      try {
        const response = await fetch(
          `/api/market?symbol=${symbol}&exchange=${exchange}&interval=${interval}`,
          {
            cache: "no-store",
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(12_000),
            ]),
          },
        );
        const body = await response.json();
        if (!response.ok) {
          const retry = Number(response.headers.get("Retry-After"));
          if (Number.isFinite(retry) && retry > 0)
            delay = Math.max(delay, Math.min(retry, 3600) * 1000);
          throw new Error(
            typeof body.error === "string" ? body.error : "行情服务暂时不可用",
          );
        }
        const snapshot = readMarketSnapshot(body, symbol, exchange, interval);
        if (active) {
          const receivedAt = Date.now();
          setNow(receivedAt);
          setState({
            snapshot,
            receivedAt,
            error: null,
            loading: false,
            retryAt: 0,
          });
        }
      } catch (error) {
        if (active)
          setState((previous) => ({
            ...previous,
            loading: false,
            error:
              error instanceof DOMException && error.name === "TimeoutError"
                ? "行情请求超时，实时信号已暂停"
                : error instanceof TypeError
                  ? "无法连接行情服务，实时信号已暂停"
                  : error instanceof Error
                    ? error.message
                    : "行情连接失败，实时信号已暂停",
            retryAt: Date.now() + delay,
          }));
      } finally {
        if (active) timer = setTimeout(load, delay);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [symbol, enabled, exchange, interval, revision]);
  const snapshot =
    state.snapshot?.symbol === symbol &&
    state.snapshot?.source === exchange &&
    state.snapshot?.interval === interval
      ? state.snapshot
      : null;
  const ageMs = snapshot
    ? snapshot.ageMs + Math.max(0, Math.max(now, Date.now()) - state.receivedAt)
    : Infinity;
  const healthy =
    enabled &&
    !!snapshot &&
    !state.error &&
    ageMs <= maxAgeForInterval(interval);
  return {
    snapshot,
    healthy,
    ageMs,
    loading: state.loading,
    error: state.error,
    receivedAt: snapshot ? state.receivedAt : 0,
    retrySeconds: Math.max(0, Math.ceil((state.retryAt - now) / 1000)),
    refresh: () => {
      if (Date.now() >= state.retryAt) setRevision((n) => n + 1);
    },
  };
}
```

### `app/api/market/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  fetchBinanceMarket,
  isMarketSymbol,
  MarketError,
  maxAgeForInterval,
  intervalMs,
  isExchange,
  isCandleInterval,
  type Exchange,
  type MarketSymbol,
} from "@/lib/binance";
import { fetchOkxMarket } from "@/lib/okx";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Snapshot = Awaited<ReturnType<typeof fetchBinanceMarket>>;
// Bounded to 2 exchanges × 2 symbols × 10 intervals; no arbitrary upstream URLs.
const exchangeCooldown = new Map<
  Exchange,
  { until: number; error: MarketError }
>();
const cache = new Map<
  string,
  {
    data?: Snapshot;
    pending?: Promise<Snapshot>;
    blockedUntil?: number;
    error?: MarketError;
  }
>();
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "BTCUSDT";
  if (!isMarketSymbol(symbol))
    return NextResponse.json(
      { error: "仅支持 BTCUSDT 和 ETHUSDT" },
      { status: 400 },
    );
  const exchange = request.nextUrl.searchParams.get("exchange") ?? "binance";
  const interval = request.nextUrl.searchParams.get("interval") ?? "1m";
  if (!isExchange(exchange) || !isCandleInterval(interval))
    return NextResponse.json(
      { error: "不支持的交易所或 K 线周期" },
      { status: 400 },
    );
  const key = `${exchange}:${symbol}:${interval}`;
  const entry = cache.get(key) ?? {};
  cache.set(key, entry);
  try {
    const cooldown = exchangeCooldown.get(exchange);
    if (cooldown && cooldown.until > Date.now())
      throw new MarketError(
        cooldown.error.message,
        429,
        Math.ceil((cooldown.until - Date.now()) / 1000),
      );
    if (entry.blockedUntil && entry.blockedUntil > Date.now())
      throw new MarketError(
        entry.error?.message ?? "请稍后重试",
        entry.error?.status ?? 503,
        Math.ceil((entry.blockedUntil - Date.now()) / 1000),
      );
    let data = entry.data;
    if (!data || Date.now() - data.fetchedAt >= 10_000) {
      entry.pending ??=
        exchange === "okx"
          ? fetchOkxMarket(symbol, fetch, interval)
          : fetchBinanceMarket(symbol, fetch, interval);
      try {
        data = await entry.pending;
        entry.data = data;
      } finally {
        entry.pending = undefined;
      }
    }
    const lastClosedAt =
      Date.parse(data.candles[data.candles.length - 1].datetime) +
      intervalMs(interval);
    const ageMs =
      data.serverTime - lastClosedAt + Math.max(0, Date.now() - data.fetchedAt);
    if (ageMs > maxAgeForInterval(interval))
      throw new MarketError("行情已过期，暂停研究信号");
    return NextResponse.json(
      { ...data, ageMs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const failure =
      error instanceof MarketError
        ? error
        : new MarketError("行情暂时不可用，实时信号已暂停");
    if (failure.status === 429)
      exchangeCooldown.set(exchange, {
        until: Date.now() + failure.retryAfter * 1000,
        error: failure,
      });
    entry.data = undefined;
    entry.error = failure;
    entry.blockedUntil = Date.now() + failure.retryAfter * 1000;
    return NextResponse.json(
      { error: failure.message },
      {
        status: failure.status,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(failure.retryAfter),
        },
      },
    );
  }
}
```

### `lib/market-types.ts`

```ts
import type { Candle } from "./engine";
export const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
export type MarketSymbol = (typeof SYMBOLS)[number];
export const EXCHANGES = ["binance", "okx"] as const;
export type Exchange = (typeof EXCHANGES)[number];
export const exchangeNames: Record<Exchange, string> = {
  binance: "币安",
  okx: "OKX",
};
export const TIMEFRAMES = [
  ["1m", "1 分钟", 1],
  ["3m", "3 分钟", 3],
  ["5m", "5 分钟", 5],
  ["10m", "10 分钟", 10],
  ["15m", "15 分钟", 15],
  ["30m", "30 分钟", 30],
  ["1h", "1 小时", 60],
  ["2h", "2 小时", 120],
  ["4h", "4 小时", 240],
  ["1d", "1 天", 1440],
] as const;
export type CandleInterval = (typeof TIMEFRAMES)[number][0];
export const intervalMs = (interval: CandleInterval) =>
  TIMEFRAMES.find((row) => row[0] === interval)![2] * 60000;
export const intervalLabel = (interval: CandleInterval) =>
  TIMEFRAMES.find((row) => row[0] === interval)![1];
export const MAX_MARKET_AGE_MS = 120000;
export const MARKET_POLL_MS = 15000;
export const maxAgeForInterval = (interval: CandleInterval) =>
  interval === "1m"
    ? MAX_MARKET_AGE_MS
    : intervalMs(interval) + MAX_MARKET_AGE_MS;
export type MarketSnapshot = {
  source: Exchange;
  symbol: MarketSymbol;
  interval: CandleInterval;
  candles: Candle[];
  serverTime: number;
  fetchedAt: number;
  ageMs: number;
};
export const isMarketSymbol = (v: unknown): v is MarketSymbol =>
  typeof v === "string" && SYMBOLS.includes(v as MarketSymbol);
export const isExchange = (v: unknown): v is Exchange =>
  typeof v === "string" && EXCHANGES.includes(v as Exchange);
export const isCandleInterval = (v: unknown): v is CandleInterval =>
  typeof v === "string" && TIMEFRAMES.some((row) => row[0] === v);
export class MarketError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryAfter = 15,
  ) {
    super(message);
  }
}
export function validateMarketCandles(
  rows: Candle[],
  serverTime: number,
  interval: CandleInterval,
): Candle[] {
  if (
    !Number.isSafeInteger(serverTime) ||
    serverTime <= 0 ||
    !Array.isArray(rows)
  )
    throw new MarketError("行情响应格式无效");
  const duration = intervalMs(interval);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i],
      time = Date.parse(r.datetime);
    if (
      !Number.isSafeInteger(time) ||
      time % duration !== 0 ||
      time + duration > serverTime
    )
      throw new MarketError("已收盘 K 线时间无效");
    if (
      ![r.open, r.high, r.low, r.close, r.volume].every(Number.isFinite) ||
      Math.min(r.open, r.high, r.low, r.close) <= 0 ||
      r.volume < 0 ||
      r.high < Math.max(r.open, r.close) ||
      r.low > Math.min(r.open, r.close) ||
      r.low > r.high
    )
      throw new MarketError("OHLCV 数值无效");
    if (i && time - Date.parse(rows[i - 1].datetime) !== duration)
      throw new MarketError("K 线存在缺失或重复");
  }
  if (rows.length < (interval === "1m" ? 120 : 2))
    throw new MarketError("已收盘 K 线不足");
  const age = serverTime - Date.parse(rows.at(-1)!.datetime) - duration;
  if (age < 0 || age > maxAgeForInterval(interval))
    throw new MarketError("行情已过期，暂停研究信号");
  return rows;
}
// Both exchanges lack native 10m candles. Aggregate only complete UTC-aligned groups.
export function aggregateCandles(
  rows: Candle[],
  target: CandleInterval,
  base: CandleInterval,
): Candle[] {
  const duration = intervalMs(target),
    step = intervalMs(base),
    count = duration / step;
  if (!Number.isInteger(count) || count < 1)
    throw new MarketError("不支持此周期聚合");
  const groups = new Map<number, Candle[]>();
  for (const r of rows) {
    const key = Math.floor(Date.parse(r.datetime) / duration) * duration;
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .filter(
      ([key, group]) =>
        group.length === count &&
        group.every((r, i) => Date.parse(r.datetime) === key + i * step),
    )
    .map(([key, g]) => ({
      datetime: new Date(key).toISOString(),
      open: g[0].open,
      high: Math.max(...g.map((r) => r.high)),
      low: Math.min(...g.map((r) => r.low)),
      close: g.at(-1)!.close,
      volume: g.reduce((sum, r) => sum + r.volume, 0),
    }));
}
```

### `lib/okx.ts`

```ts
import type { Candle } from "./engine";
import {
  MarketError,
  aggregateCandles,
  validateMarketCandles,
  isMarketSymbol,
  intervalMs,
  type MarketSnapshot,
  type MarketSymbol,
  type CandleInterval,
} from "./market-types";
const bars: Record<Exclude<CandleInterval, "10m">, string> = {
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1H",
  "2h": "2H",
  "4h": "4H",
  "1d": "1Dutc",
};
export function decodeOkxCandles(
  raw: unknown,
  serverTime: number,
  interval: CandleInterval,
): Candle[] {
  if (!Array.isArray(raw)) throw new MarketError("OKX K 线格式无效");
  const rows: Candle[] = [];
  for (const r of raw) {
    if (!Array.isArray(r) || r.length < 9 || !["0", "1"].includes(String(r[8])))
      throw new MarketError("OKX K 线确认状态无效");
    const time = Number(r[0]);
    if (!Number.isSafeInteger(time) || time % intervalMs(interval) !== 0)
      throw new MarketError("OKX K 线时间无效");
    if (String(r[8]) !== "1" || time + intervalMs(interval) > serverTime)
      continue;
    const nums = r
      .slice(1, 6)
      .map((v) =>
        typeof v === "number" || (typeof v === "string" && v.trim() !== "")
          ? Number(v)
          : NaN,
      );
    rows.push({
      datetime: new Date(time).toISOString(),
      open: nums[0],
      high: nums[1],
      low: nums[2],
      close: nums[3],
      volume: nums[4],
    });
  }
  return rows.sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));
}
export async function fetchOkxMarket(
  symbol: MarketSymbol,
  fetcher: typeof fetch = fetch,
  interval: CandleInterval = "1m",
): Promise<Omit<MarketSnapshot, "ageMs">> {
  if (!isMarketSymbol(symbol))
    throw new MarketError("仅支持 BTCUSDT 和 ETHUSDT", 400);
  const requestedAt = Date.now(),
    base = interval === "10m" ? "5m" : interval;
  const deadline = AbortSignal.timeout(10000);
  async function get(path: string): Promise<unknown[]> {
    let response: Response;
    try {
      response = await fetcher("https://www.okx.com/api/v5/" + path, {
        cache: "no-store",
        redirect: "error",
        signal: deadline,
      });
    } catch {
      throw new MarketError("无法连接 OKX 公开行情；实时信号已暂停");
    }
    if (response.status === 429)
      throw new MarketError(
        "OKX 请求限流，请稍后重试",
        429,
        Math.max(
          15,
          Math.min(3600, Number(response.headers.get("Retry-After")) || 60),
        ),
      );
    if (response.status === 403 || response.status === 451)
      throw new MarketError("当前部署区域无法访问 OKX 公开行情", 503, 60);
    if (!response.ok) throw new MarketError("OKX 行情服务暂时不可用");
    let body: { code?: string; data?: unknown[] };
    try {
      body = await response.json();
    } catch {
      throw new MarketError("OKX 返回无效 JSON");
    }
    if (String(body.code) === "50011")
      throw new MarketError("OKX 请求限流，请稍后重试", 429, 60);
    if (String(body.code) !== "0" || !Array.isArray(body.data))
      throw new MarketError("OKX 行情响应无效");
    return body.data;
  }
  const clock = await get("public/time");
  const serverTime = Number((clock[0] as { ts?: string })?.ts);
  if (!Number.isSafeInteger(serverTime) || serverTime <= 0)
    throw new MarketError("OKX 服务器时间无效");
  const desired = interval === "1m" ? 1001 : interval === "10m" ? 404 : 202;
  let raw: unknown[] = [];
  let after: string | undefined;
  // API returns newest first; bounded pagination supplies 5m EMA100 warmup at 1m.
  for (let page = 0; page < 4 && raw.length < desired; page++) {
    const query = new URLSearchParams({
      instId: symbol === "BTCUSDT" ? "BTC-USDT" : "ETH-USDT",
      bar: bars[base],
      limit: String(Math.min(300, desired - raw.length)),
    });
    if (after) query.set("after", after);
    const batch = await get("market/history-candles?" + query);
    if (!batch.length) break;
    const times = batch.map((r) => (Array.isArray(r) ? Number(r[0]) : NaN));
    if (!times.every(Number.isSafeInteger))
      throw new MarketError("OKX 分页时间无效");
    const earliest = Math.min(...times);
    if (after && earliest >= Number(after))
      throw new MarketError("OKX 分页未前进");
    raw.push(...batch);
    after = String(earliest);
  }
  const decoded = validateMarketCandles(
    decodeOkxCandles(raw, serverTime, base),
    serverTime,
    base,
  );
  const candles =
    interval === "10m"
      ? validateMarketCandles(
          aggregateCandles(decoded, "10m", "5m"),
          serverTime,
          "10m",
        )
      : decoded;
  return {
    source: "okx",
    symbol,
    interval,
    candles,
    serverTime,
    fetchedAt: requestedAt,
  };
}
```

### `lib/chart-data.ts`

```ts
import { simulate, type Candle } from "./engine";
import {
  aggregateCandles,
  intervalMs,
  type CandleInterval,
} from "./market-types";
export function simulatedChartRows(
  rows: Candle[],
  interval: CandleInterval,
): Candle[] {
  if (interval === "1m") return rows;
  const aggregated = aggregateCandles(rows, interval, "1m");
  if (aggregated.length >= 2) return aggregated;
  // Explicitly synthetic chart demonstration when the 24h sample cannot supply
  // multiple daily bars. This does not replace the signal's 1-minute input.
  const duration = intervalMs(interval);
  const end =
    Math.floor((Date.parse(rows.at(-1)!.datetime) + 60000) / duration) *
    duration;
  return simulate(17, 200).map((r, i) => ({
    ...r,
    datetime: new Date(end - (200 - i) * duration).toISOString(),
    volume: (r.volume * duration) / 60000,
  }));
}
```

### `lib/alerts.ts`

```ts
import type { Signal } from "./engine";
export type AlertCursor = { stream: string; time: string };
export function advanceSignalAlert(
  cursor: AlertCursor | null,
  stream: string,
  signal: Signal,
): { cursor: AlertCursor; notify: boolean } {
  const next = { stream, time: signal.time };
  if (!cursor || cursor.stream !== stream)
    return { cursor: next, notify: false };
  if (Date.parse(signal.time) <= Date.parse(cursor.time))
    return { cursor, notify: false };
  return {
    cursor: next,
    notify: signal.ready && signal.direction !== "neutral",
  };
}
```

### `components/signal-alerts.tsx`

```tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Volume2, X } from "lucide-react";
import { useResearch } from "./provider";
import { analyze, displayTime, labels } from "@/lib/engine";
import { advanceSignalAlert, type AlertCursor } from "@/lib/alerts";
import { exchangeNames } from "@/lib/market-types";
import { Button } from "./ui/button";
type Notice = { id: string; title: string; detail: string; test: boolean };
export function SignalAlerts() {
  const { market, marketMode, exchange, symbol, params } = useResearch();
  const [enabled, setEnabled] = useState(true),
    [sound, setSound] = useState(false),
    [system, setSystem] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [history, setHistory] = useState<Notice[]>([]);
  const [total, setTotal] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const cursor = useRef<AlertCursor | null>(null);
  const signals = useMemo(
    () => (market.snapshot ? analyze(market.snapshot.candles, params) : []),
    [market.snapshot, params],
  );
  useEffect(() => {
    setPermission(
      "Notification" in window ? Notification.permission : "unsupported",
    );
    return () => {
      void audio.current?.close().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 12000);
    return () => clearTimeout(timer);
  }, [notice]);
  function beep() {
    const context = audio.current;
    if (!context || context.state !== "running") return;
    for (let i = 0; i < 2; i++) {
      const oscillator = context.createOscillator(),
        gain = context.createGain(),
        start = context.currentTime + i * 0.22;
      oscillator.type = "sine";
      oscillator.frequency.value = i ? 740 : 540;
      gain.gain.setValueAtTime(0.04, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    }
  }
  function deliver(item: Notice) {
    setNotice(item);
    setHistory((items) => [item, ...items].slice(0, 10));
    if (!item.test) setTotal((value) => value + 1);
    if (sound) beep();
    if (
      system &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(item.title, { body: item.detail, tag: item.id });
      } catch {
        setMessage("当前浏览器不支持此类系统通知，仍会显示页面提醒。");
      }
    }
  }
  useEffect(() => {
    if (!enabled) {
      cursor.current = null;
      return;
    }
    if (marketMode !== "live") {
      cursor.current = null;
      return;
    }
    if (!market.healthy || !signals.length) return;
    const latest = signals.at(-1)!;
    const stream = `${exchange}:${symbol}:${JSON.stringify(params)}`;
    const result = advanceSignalAlert(cursor.current, stream, latest);
    cursor.current = result.cursor;
    if (result.notify) {
      const row = market.snapshot!.candles.at(-1)!;
      deliver({
        id: `${stream}:${latest.time}:${latest.direction}`,
        title: `${exchangeNames[exchange]} ${symbol.replace("USDT", "/USDT")} · ${labels[latest.direction]}研究信号`,
        detail: `${displayTime(latest.time)} 收盘确认 · 参考价 ${row.close.toFixed(2)} USDT · 观察 10 分钟，仅供研究。`,
        test: false,
      });
    }
  }, [enabled, marketMode, market.healthy, signals, exchange, symbol, params]);
  async function toggleSound() {
    if (sound) {
      setSound(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      if (audio.current.state !== "running") throw Error();
      setSound(true);
      beep();
      setMessage("声音已开启；请保持页面运行，浏览器可能限制后台声音。");
    } catch {
      setMessage("当前浏览器未允许声音，页面文字提醒仍然可用。");
    }
  }
  async function toggleSystem() {
    if (system) {
      setSystem(false);
      return;
    }
    if (!("Notification" in window)) {
      setMessage("当前浏览器不支持系统通知，仍可使用页面提醒。");
      return;
    }
    try {
      const status = await Notification.requestPermission();
      setPermission(status);
      setSystem(status === "granted");
      setMessage(
        status === "granted"
          ? "系统通知已开启；浏览器关闭或设备休眠后无法保证提醒。"
          : "系统通知未获许可，可在浏览器站点设置中修改；页面提醒仍可用。",
      );
    } catch {
      setMessage("无法开启系统通知，页面提醒仍可用。");
    }
  }
  return (
    <section
      aria-label="信号提醒设置"
      className="mb-5 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 flex items-center gap-2 text-xs">
          <Bell size={14} className="text-primary" />
          新信号提醒
        </span>
        <Button
          variant={enabled ? "default" : "outline"}
          size="sm"
          aria-pressed={enabled}
          onClick={() => setEnabled((v) => !v)}
        >
          {enabled ? "页面提醒已开" : "页面提醒已关"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={sound}
          disabled={!enabled}
          onClick={toggleSound}
        >
          <Volume2 size={12} />
          {sound ? "声音已开" : "开启声音"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={system}
          disabled={!enabled || permission === "unsupported"}
          onClick={toggleSystem}
        >
          {system ? "系统通知已开" : "开启系统通知"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!enabled}
          onClick={() =>
            deliver({
              id: `test:${Date.now()}`,
              title: "测试提醒",
              detail: "这是一条提醒测试，不代表产生了行情信号。",
              test: true,
            })
          }
        >
          测试提醒
        </Button>
        <span className="text-[10px] text-muted" data-testid="alert-count">
          本页会话 {total} 条新信号
        </span>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted">
        只提醒连接正常后最新已收盘的 1
        分钟信号；图表周期不影响提醒。首次加载、切换行情源、修改规则及模拟模式不触发历史提醒。请保持网页运行，浏览器关闭后不提供后台推送。
      </p>
      {message && <p className="mt-2 text-[10px] text-muted">{message}</p>}
      {history.length > 0 && (
        <details className="mt-3 text-[10px] text-muted">
          <summary className="cursor-pointer">最近提醒（最多 10 条）</summary>
          <ul className="mt-2 space-y-2">
            {history.map((item) => (
              <li key={item.id} className="rounded border border-border p-2">
                <span className="text-foreground">{item.title}</span>
                <p className="mt-1 leading-5">{item.detail}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
      {notice && (
        <aside
          role="status"
          data-testid="signal-notice"
          className="fixed bottom-5 right-4 z-50 w-[min(380px,calc(100vw-32px))] rounded-xl border border-primary/40 bg-card p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-primary">
              {notice.title}
            </h2>
            <button aria-label="关闭信号提醒" onClick={() => setNotice(null)}>
              <X size={15} />
            </button>
          </div>
          <p className="mt-3 text-xs leading-6 text-muted">{notice.detail}</p>
        </aside>
      )}
    </section>
  );
}
```
