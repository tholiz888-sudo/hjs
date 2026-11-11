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
        <span>仅供研究学习，不构成任何投资建议，过去表现不代表未来结果</span>
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
          <span>© 2026 SIGNAL LAB · 研究与教育用途</span>
          <span>所有信号均由模拟数据生成 · UTC+8</span>
        </footer>
      </div>
    </>
  );
}
