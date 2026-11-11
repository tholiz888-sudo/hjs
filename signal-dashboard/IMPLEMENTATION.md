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
  components/
    shell.tsx
    provider.tsx
    charts.tsx
    ui/{button,card,badge,input,switch}.tsx
  lib/
    engine.ts
    market-data.ts
    utils.ts
  tests/engine.test.ts
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

Next.js 14 App Router、React 18、TypeScript、Tailwind CSS 3、Radix/shadcn UI 基础组件及 Recharts。


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
    "typecheck": "tsc --noEmit",
    "test": "tsx --test tests/*.test.ts"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.4.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "next": "14.2.35",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.15.4",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.20.0",
    "typescript": "^5.7.0"
  },
  "engines": {
    "node": "24.x"
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
const disclaimer =
  "仅供研究学习，不构成任何投资建议。历史表现不代表未来结果，交易有风险，请谨慎决策。";
const links = [
  { href: "/", title: "信号仪表盘", icon: LayoutDashboard },
  { href: "/rules", title: "规则与参数", icon: Settings2 },
  { href: "/backtest", title: "策略回测", icon: ChartNoAxesCombined },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
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
            本地模拟环境 <ArrowUpRight size={12} />
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
              模拟引擎就绪
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
        <main>{children}</main>
        <footer>
          <p className="w-full rounded-lg border border-[#453921] bg-[#272219] p-3 text-[11px] leading-6 text-[#d0b888]">
            {disclaimer}
          </p>
          <span>© 2026 SIGNAL LAB · 研究与教育用途</span>
          <span>所有信号均由模拟数据生成 · UTC+8</span>
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
import { defaults, type Params, simulate, validateParams } from "@/lib/engine";
const Context = createContext<{
  params: Params;
  save: (p: Params) => void;
  rows: ReturnType<typeof simulate>;
  regenerate: () => void;
}>({
  params: defaults,
  save: () => {},
  rows: simulate(),
  regenerate: () => {},
});
export function ResearchProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState(defaults);
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
    <Context.Provider value={{ params, save, rows, regenerate }}>
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

大号三态信号、过滤条件、当前模拟价格、Recharts OHLC 蜡烛图和最近 20 条触发信号。数据量不足时仅展示实际存在的信号；不伪造历史条数。过滤条件计数是规则满足情况，不是预测概率。


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
  simulate,
} from "@/lib/engine";
import { price, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceChart } from "@/components/charts";
export default function Dashboard() {
  const { params, rows, regenerate } = useResearch();
  const [range, setRange] = useState(60);
  const [showEma, setShowEma] = useState(true);
  const [notice, setNotice] = useState("");
  const signals = useMemo(() => analyze(rows, params), [rows, params]);
  const stats = useMemo(() => backtest(rows, params), [rows, params]);
  const current = signals[signals.length - 1],
    last = rows[rows.length - 1],
    prior = rows[rows.length - 61];
  const change = (last.close / prior.close - 1) * 100;
  const recent = signals
    .map((s, i) => ({ ...s, index: i }))
    .filter((s) => s.direction !== "neutral")
    .slice(-20)
    .reverse();
  const chart = rows.slice(-range).map((r, i) => ({
    time: r.datetime,
    price: r.close,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    fast: signals[rows.length - range + i].fast,
    slow: signals[rows.length - range + i].slow,
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
          { source: "模拟数据 · 仅供研究学习", params, signal: current },
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
    setNotice("模拟信号快照已导出");
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f8a63c] text-lg font-bold text-[#3b2205]">
            ₿
          </div>
          <span className="font-semibold tracking-wide">
            BTC <span className="text-muted">/ USDT</span>
          </span>
          <Badge>模拟市场</Badge>
          <span className="hidden text-[11px] text-muted sm:inline">
            1 分钟 K 线 · 10 分钟观察窗
          </span>
        </div>
        <span className="flex items-center gap-2 text-[10px] text-muted">
          <Clock3 size={12} />
          样本时间 {displayDate(last.datetime)} {displayTime(last.datetime)}{" "}
          UTC+8
        </span>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "最新模拟价格",
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
                <span className="data-label">模拟数据</span>
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
                  <CardTitle>1 分钟 K 线</CardTitle>
                  <Badge>模拟数据</Badge>
                </div>
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
                      {n === 180 ? "3 小时" : `${n} 分钟`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-2xl font-medium tabular-nums">
                  {price(last.close)}
                </span>
                <span className="text-[10px] text-muted">USDT</span>
                <span
                  className={cn(
                    "text-[10px]",
                    change >= 0 ? "text-positive" : "text-negative",
                  )}
                >
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <PriceChart data={chart} showEma={showEma} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-3">
                <div className="flex gap-4 text-[10px] text-muted">
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-primary" />
                    模拟 K 线
                  </span>
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-[#76aee7]" />
                    EMA {params.fast}
                  </span>
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-[#a79bd3]" />
                    EMA {params.slow}
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
              仅展示收盘时触发的历史模拟信号，不代表实际成交或未来收益。
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
                <Badge className="border-0 bg-white/5">模拟数据</Badge>
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
                    {labels[current.direction]}
                  </div>
                  <div className="mt-1 text-[9px] tracking-[.18em]">
                    {current.direction === "neutral"
                      ? "WAIT FOR CONFIRMATION"
                      : current.direction === "bullish"
                        ? "BULLISH SIGNAL"
                        : "BEARISH SIGNAL"}
                  </div>
                </div>
              </div>
              <p className="text-[11px] leading-6 text-muted">
                {current.direction === "neutral"
                  ? "过滤条件尚未全部满足，等待趋势与交叉形成共振。保持观望也是研究的一部分。"
                  : params.trendEnabled
                    ? "趋势方向与均线交叉一致，RSI 和成交量过滤均已通过。下一根开盘起观察 10 分钟。"
                    : "趋势过滤已关闭；均线交叉、RSI 和成交量过滤通过。下一根开盘起观察 10 分钟。"}
              </p>
              <div className="my-5 border-t border-border" />
              <div className="mb-4 flex justify-between text-[10px]">
                <span className="text-muted">过滤条件</span>
                <span>
                  {
                    current.filters.filter((f) => f.enabled !== false && f.pass)
                      .length
                  }{" "}
                  / {current.filters.filter((f) => f.enabled !== false).length}{" "}
                  已满足
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
                onClick={() => {
                  regenerate();
                  setNotice("已重新生成一组模拟行情，并重新计算信号");
                }}
              >
                <RefreshCw size={13} />
                重新生成模拟行情
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
}: {
  data: CandleChartPoint[];
  showEma?: boolean;
}) {
  const candles = data.map((row) => ({ ...row, wick: [row.low, row.high] }));
  return (
    <div
      className="chart-box"
      role="img"
      aria-label="模拟 1 分钟 OHLC 蜡烛 K 线和 EMA 均线图"
    >
      <div className="chart-watermark">SIMULATED</div>
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
            tickFormatter={displayTime}
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
                    {displayTime(String(label))} · 模拟数据
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
            name="模拟 K 线"
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
            调整过滤条件，实时观察同一组模拟数据下的信号变化。
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

浏览器解析 CSV；下一根开盘进入、十根分钟 K 线后退出；仅统计完成观察窗、不重叠。零收益不算胜利、会中断连续亏损。显示胜率、平均收益、连续亏损、累计收益、最大回撤和分页明细。未计交易成本。


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
import {
  backtest,
  displayTime,
  labels,
  parseCsv,
  type Candle,
} from "@/lib/engine";
import { price } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EquityChart } from "@/components/charts";
export default function Backtest() {
  const { params, rows: sample } = useResearch();
  const [customRows, setRows] = useState<Candle[] | null>(null);
  const rows = customRows ?? sample;
  const [source, setSource] = useState("内置模拟数据");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const result = useMemo(() => backtest(rows, params), [rows, params]);
  const pages = Math.max(1, Math.ceil(result.total / 10));
  const safePage = Math.min(page, pages - 1);
  const uploaded = source !== "内置模拟数据";
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
      setRows(parsed);
      setSource(file.name);
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
                  setRows(null);
                  setSource("内置模拟数据");
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
          未计手续费、滑点、资金费、流动性及交易执行约束；最大回撤仅基于已平仓权益，未反映持仓内波动。上传数据不会传往服务器，不会自动验证其真实性。零交易不等于策略有效。
        </p>
      </div>
    </>
  );
}
```

## 7. 模拟数据与简单信号计算逻辑

确定性模拟 OHLCV、EMA、Wilder RSI、完整 5 分钟聚合、成交量过滤、趋势开关、回测与严格 CSV 校验。市场数据适配接口预留后续 HTTP/WebSocket 接入，当前没有真实行情请求或订单执行。


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
          detail: crossUp
            ? "本根收盘发生上穿"
            : crossDown
              ? "本根收盘发生下穿"
              : "本根收盘未发生交叉",
          pass: crossUp || crossDown,
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
    const ret = (exit / entry - 1) * (s.direction === "bullish" ? 1 : -1);
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
      equity,
    });
    curve.push({
      time: new Date(Date.parse(rows[i + 10].datetime) + 60000).toISOString(),
      equity,
      returnPct: (equity / 10000 - 1) * 100,
    });
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
    returnPct: (equity / 10000 - 1) * 100,
  };
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
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        raw,
      )
    )
      throw new Error(`第 ${index + 2} 行时间请使用含时区的 ISO 格式`);
    const time = Date.parse(raw);
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

// Integration boundary: a future HTTP/WebSocket adapter must return continuous,
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
// Future: implement a LiveMarketDataSource with the same interface and explicitly
// change source labels after verifying actual exchange responses and timestamps.
```
