# 十分钟 SIGNAL · 短周期信号研究仪表盘

仅供研究学习，不构成任何投资建议，过去表现不代表未来结果。

## 启动

Node.js 20+（当前环境 Node 24）。本项目独立于仓库原有网站，默认端口 3010。

```sh
cd /workspace/hjs/signal-dashboard
npm ci --cache /tmp/hjs-npm-cache
npm run dev
```

生产运行：`npm run build && npm start`。验证：`npm test`、`npm run typecheck`。

## 技术与目录

Next.js 14 App Router、React 18、TypeScript、Tailwind CSS 3、Recharts、Lucide，以及本地 shadcn/ui 风格的 Radix Slot / CVA 基础组件。`components.json` 提供后续 shadcn 组件配置。

```text
app/
  layout.tsx           全站布局、固定风险提示与导航
  page.tsx             仪表盘：方向、过滤条件、价格曲线、历史信号
  rules/page.tsx       参数编辑、即时重算、本地保存
  backtest/page.tsx    CSV 上传、统计、权益曲线、分页明细
  globals.css          深色主题与响应式布局
components/
  ui/                  Button / Card / Badge / Input 基础组件
  shell.tsx            导航与风险提示
  provider.tsx         参数状态与 localStorage
  charts.tsx           价格及权益图表
lib/
  engine.ts            EMA / Wilder RSI / 信号 / 回测 / CSV 校验
  utils.ts             样式合并、价格格式化
tests/engine.test.ts    指标、无前视、回测及 CSV 测试
```

## 信号逻辑

输入为连续的 1 分钟 K 线（时间字段表示开盘时间，信号在该根收盘才确认，信号时间与退出时间显示实际收盘时刻）。只有完整收盘的 5 分钟 K 线进入 EMA20；价格高于 EMA 且 EMA 向上时允许看涨，反向允许看跌。当前 1 分钟 EMA3 上穿或下穿 EMA8，且方向与趋势一致；RSI(7) 在 30–70（含边界）；当前成交量严格大于之前 20 根均量 × 1.1。四项一致才触发，否则观望。参数可调整；修改逻辑集中在 `lib/engine.ts`。

首页“重新生成模拟行情”切换确定性随机种子，固定样本时间，不伪装实时行情。参数在页面间共享、存入浏览器 localStorage。规则页预览、回测使用固定种子 42。内置样本 1,440 根（24 小时），无外部行情 API。

## CSV 与回测口径

字段：`datetime,open,high,low,close,volume`。时间须是含时区的 ISO 8601，例如 `2026-11-10T00:00:00Z`，整分钟、连续、升序、无重复。至少 120 行、最多 20,000 行、5 MB；数值有限，OHLC 为正，成交量非负，高低价须包络开收盘。此解析器支持标准数字及 ISO 时间列，不支持字段内含逗号的通用 CSV。文件仅在浏览器解析。

信号收盘确认后，下一根开盘入场，持有十根 1 分钟 K 线后收盘退出；单仓位、不重叠、尾部未完成窗口不结算。收益按无杠杆方向价格变化，初始模拟权益 10,000、全额复利；胜率仅统计正收益，持平计非胜。平均每笔为算术平均，最大回撤基于已平仓权益。未计费用、滑点、资金费及持仓内回撤，不对应二元合约赔付结构或真实执行收益。

## 后续扩展

将行情源替换为校验后的 Candle[]，保留收盘时间语义；接入真实数据时应同步调整“模拟”标识和数据来源说明。订单执行、交易所连接、实时行情和预测准确性不在此项目范围内。

## 部署到 Render

此项目应创建独立 Web Service，避免覆盖仓库原有网站。仓库根目录的 `render.yaml` 属于原站；新仪表盘的 Blueprint 配置是 `signal-dashboard/render.yaml`。

在 Render 新建 Web Service，连接 `tholiz888-sudo/hjs` 并选择包含此项目的分支，配置：

| 设置 | 值 |
| --- | --- |
| Runtime | Node |
| Root Directory | `signal-dashboard` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/` |
| Instance Type | Free |
| NODE_VERSION | `24.22.1` |
| NEXT_TELEMETRY_DISABLED | `1` |

生产启动监听 `0.0.0.0`，自动读取 Render 提供的 `PORT`；本地未设置 PORT 时默认 3000，开发模式仍默认 3010。部署不需要应用密钥或数据库，用户参数和 CSV 保留在各自浏览器中。免费服务空闲后可能休眠。

如使用 Blueprint，在创建流程将 Blueprint Path 设置为 `signal-dashboard/render.yaml`。部署完成后应验证 `/`、`/rules`、`/backtest` 三个页面和固定风险提示，再确认参数保存及 CSV 导入。
