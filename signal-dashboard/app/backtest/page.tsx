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
