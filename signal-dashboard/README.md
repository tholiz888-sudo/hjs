# 十分钟 SIGNAL · 短周期信号研究仪表盘

仅供研究学习，不构成任何投资建议。历史表现不代表未来结果，交易有风险，请谨慎决策。

## 启动

Node.js 24。本项目独立于仓库原有网站，默认端口 3010。

```sh
cd /workspace/hjs/signal-dashboard
npm ci --cache /tmp/hjs-npm-cache
npm run dev
```

生产运行：`npm run build && npm start`。验证：`npm test`、`npm run typecheck`。

## 技术与目录

Next.js 15.5.29 App Router（修复已知漏洞后升级）、React 18、TypeScript、Tailwind CSS 3、Recharts、Lucide，以及本地 shadcn/ui 风格的 Radix Slot / CVA 基础组件。`components.json` 提供后续 shadcn 组件配置。

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

输入为连续的 1 分钟 K 线（时间字段表示开盘时间，信号在该根收盘才确认，信号时间与退出时间显示实际收盘时刻）。只有完整收盘的 5 分钟 K 线进入 EMA20；价格高于 EMA 时允许看涨，低于 EMA 时允许看跌；可关闭趋势过滤，此时不要求 5 分钟趋势预热。当前 1 分钟 EMA3 上穿或下穿 EMA8，且方向与趋势一致；RSI(7) 在 30–70（含边界）；当前成交量严格大于之前 20 根均量 × 1.1。所有已启用的条件一致才触发，否则观望。参数可调整，有效修改立即共享到其他页面并保存；修改逻辑集中在 `lib/engine.ts`。

首页“重新生成模拟行情”切换确定性随机种子，固定样本时间，不伪装实时行情。参数在页面间共享、存入浏览器 localStorage。三页共用同一组模拟行情，初始种子 42；首页重新生成后规则预览及内置数据回测同步更新。内置模拟样本 1,440 根（24 小时），仅在明确选择模拟数据时用于首页；默认首页使用币安实时行情。

## CSV 与回测口径

字段：`datetime,open,high,low,close,volume`。时间须是含时区的 ISO 8601，例如 `2026-11-10T00:00:00Z`，整分钟、连续、升序、无重复。至少 120 行、最多 20,000 行、5 MB；数值有限，OHLC 为正，成交量非负，高低价须包络开收盘。此解析器支持标准数字及 ISO 时间列，不支持字段内含逗号的通用 CSV。文件仅在浏览器解析；严格校验闰年、日历日期、时分秒及整分钟对齐。上传数据保存在共享内存，切换规则页、首页再返回时保留；刷新页面或关闭标签页后需重新上传。

信号收盘确认后，下一根开盘入场，持有十根 1 分钟 K 线后收盘退出；单仓位、不重叠、尾部未完成窗口不结算。收益按无杠杆方向价格变化，初始模拟权益 10,000、全额复利；胜率仅统计正收益，持平计非胜。平均每笔为算术平均，最大回撤基于已平仓权益。最大连续亏损为连续负收益笔数，零收益或盈利会中断计数。当单笔方向价格变化导致模拟亏损达到剩余本金时，该笔计入收益率限制为 -100%、权益归零并停止回测，记录原始价格变化以供核对；这不是实际保证金强平或债务模型。未计费用、滑点、资金费及持仓内回撤，不对应二元合约赔付结构或真实执行收益。

## 后续扩展

币安公开行情已通过服务端 /api/market 接入，保留收盘时间语义并区分真实行情、历史快照及模拟数据。其他交易所可扩展 lib/market-data.ts 的接口；当前不接账户、订单执行或交易权限，也不保证方向预测准确性。

## 部署到 Render

此项目应创建独立 Web Service，避免覆盖仓库原有网站。仓库根目录的 `render.yaml` 属于原站；新仪表盘的 Blueprint 配置是 `signal-dashboard/render.yaml`。

在 Render 新建 Web Service，连接 `tholiz888-sudo/hjs` 并选择包含此项目的分支，配置：

| 设置                    | 值                                      |
| ----------------------- | --------------------------------------- |
| Runtime                 | Node                                    |
| Root Directory          | `signal-dashboard`                      |
| Build Command           | `npm ci --include=dev && npm run build` |
| Start Command           | `npm start`                             |
| Health Check Path       | `/`                                     |
| Instance Type           | Free                                    |
| NODE_VERSION            | `24.22.1`                               |
| NEXT_TELEMETRY_DISABLED | `1`                                     |

生产启动监听 `0.0.0.0`，自动读取 Render 提供的 `PORT`；本地未设置 PORT 时默认 3000，开发模式仍默认 3010。部署不需要应用密钥或数据库，用户参数和 CSV 保留在各自浏览器中。免费服务空闲后可能休眠。

如使用 Blueprint，在创建流程将 Blueprint Path 设置为 `signal-dashboard/render.yaml`。部署完成后应验证 `/`、`/rules`、`/backtest` 三个页面和固定风险提示，再确认参数保存及 CSV 导入。

## 本轮补全

首页采用 Recharts 自定义 OHLC 蜡烛 K 线，展示最近 20 条触发信号。全站顶部固定条与页脚使用同一完整风险声明。规则页支持趋势过滤开关；无效输入不覆盖最后有效参数。回测显示累计模拟收益和最大连续亏损。`lib/market-data.ts` 提供未来真实行情适配接口及收盘时间约定，当前仍完全使用模拟数据。完整代码按要求的七部分顺序整理在 `IMPLEMENTATION.md`。

## 修复与回归验证

- Next.js 从 14.2.35 升级到修复版 15.5.29；保留 React 18。PostCSS 统一到同一受支持主版本的 8.5.32 以上，锁文件固定实际版本。
- 趋势与交叉方向冲突、或指标尚未预热时，不会显示所有过滤条件已满足。
- CSV 在三个页面间保留；日历校验拒绝 2 月 30 日等会被 JavaScript 自动转换的无效日期。
- 本金耗尽时停止回测并显示说明，避免负权益继续复利。

```sh
npm test
npm run typecheck
npm run build
# 首次在常规开发机器上安装测试浏览器：
npx playwright install chromium
npm run test:browser
# 当前云环境可复用已安装的 Chromium：
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
npm audit
```

浏览器回归测试位于 `e2e/dashboard.spec.ts`；启动独立的生产服务在 10003 端口，验证跨页 CSV 调参、错误日期保留上一份数据、本金耗尽提示、图表操作与窄屏风险声明。

## 币安 BTC / ETH 行情

首页默认选择「币安实时行情」，支持 BTC/USDT 和 ETH/USDT。浏览器每 15 秒向本站 `/api/market?symbol=BTCUSDT` 请求一次；服务端请求币安官方公开行情域名 `data-api.binance.vision` 的 `/api/v3/time` 和 `/api/v3/klines`（固定 1m、最多 1,000 根），无需 API Key。

只保留已收盘、连续、数值有效的 K 线；信号随新一分钟收盘更新。显示价格是最近一分钟收盘价，不是逐笔成交报价。未完成的 1m K 线不会用于信号，5m EMA 仍只使用完整已收盘的 5m 分组。

- 每个实例按两个交易对缓存成功数据 10 秒，并合并并发请求。
- 429/418 限流时遵守 Retry-After；403/451 显示部署区域访问限制，不切换到其他域名绕过限制。
- 初次加载失败时不显示虚构价格或信号；后续失败或数据超过 2 分钟时暂停当前信号，只保留明确标记的历史图表。
- 切换交易对会取消旧请求，迟到的 BTC 响应不会覆盖 ETH。
- 模拟练习必须手动从「数据源」选择。规则页的预览及回测页的内置数据仍明确使用模拟数据，规则参数同时应用于首页币安信号。
- 胜率与收益仍是基于当前数据窗口的规则回测，不是真实成交表现。

Render 需允许访问 `https://data-api.binance.vision`。若部署区域或币安拒绝请求，页面会显示暂停原因；更换部署位置前应确认当地访问规则。当前云环境需要在环境设置中保存并发布已提出的域名访问草稿，才能执行真实外网连通验证；本地模拟响应测试不代表 Render 已连接币安。

上线检查：部署最新提交后，首页应显示「币安已连接 · 研究用途」，BTC 与 ETH 可切换，最近更新随自动轮询变化。也可访问 `/api/market?symbol=BTCUSDT` 查看 `source: "binance"`、`symbol`、`serverTime`、`ageMs` 与有效 K 线；错误响应会包含明确的 error，不返回模拟行情。不要仅以页面能打开来判断行情接入成功。

测试：`tests/binance.test.ts` 覆盖适配器、未收盘过滤、错误与限流、并发缓存和冷却；`e2e/live-market.spec.ts` 使用明确的测试响应覆盖自动轮询、切换、断线暂停和过期。真实外网连通须另行验证。
