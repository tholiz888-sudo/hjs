# 公网部署

网站包含Node.js后端和SQLite数据库，需要能运行Node.js24或Docker的服务器。只上传静态文件不能使用账号、收藏和评论功能。

## Docker与宝塔服务器

1. 将项目上传到服务器，如 `/opt/jiange`。
2. 在目录内执行 `docker compose up -d --build`。
3. 在宝塔或其他反向代理中，将自己的域名代理到 `http://127.0.0.1:3020`，启用HTTPS。
4. HTTPS配置完成后，在项目目录的 `.env` 中添加 `COOKIE_SECURE=1`，再执行 `docker compose up -d`。
5. 验证 `/api/health` 和 `/discover`，测试登录和收藏。

Compose默认只监听服务器本地地址，需经过反向代理访问。若仅需先用服务器IP测试，可在 `.env` 设置 `APP_BIND=0.0.0.0`，放行服务器TCP3020端口，再启动；访问 `http://服务器IP:3020`。切换HTTPS域名后可恢复本地监听。

容器以非root用户运行。账号等数据保存在 `jiange-data` 命名卷；升级代码时保留该卷。`docker compose down -v` 会删除数据库卷，不要在需要保留数据时使用。

## 直接运行Node.js

```sh
cd /opt/jiange
npm ci --no-audit --no-fund
npm run build
NODE_ENV=production PORT=3020 DB_PATH=/opt/jiange-storage/app.sqlite npm start
```

使用进程管理器或systemd保持运行，配置同样的反向代理、HTTPS和数据库备份。

## 部署平台

推荐先使用 Render 的免费Web Service进行在线体验。本项目根目录已提供 `render.yaml`，选择Node.js24运行方式，健康检查为 `/api/health`。免费版没有持久磁盘，配置使用 `/tmp/jiange/app.sqlite`；重新部署或实例重建后账号数据可能清空，空闲后首次访问也可能需要等待唤醒。

操作步骤：

1. 将部署包解压，把内容上传到自己的GitHub仓库根目录，确保根目录有 `render.yaml`、`Dockerfile` 和 `package.json`。
2. 打开 https://dashboard.render.com ，用GitHub登录并授权这个仓库。
3. 选择 **New → Blueprint**，选择仓库，按 `render.yaml` 创建免费服务。
4. 等构建与健康检查成功，Render会分配真实HTTPS地址。在成功之前不能提前声称已经上线。

本项目代码已由助手推送至 `https://github.com/tholiz888-sudo/hjs/tree/codex/jiange-deploy`，因此无需重复上传部署包。在Render选择仓库 `tholiz888-sudo/hjs`，Blueprint分支选择 `codex/jiange-deploy`。仓库的 `main` 分支含其他项目，不应直接替换或用来部署本复刻版。

Render的GitHub授权只能由用户在平台上完成，不需要把GitHub或Render密码发到聊天中。配置中没有创建付费磁盘；如升级为长期使用，先确认费用，再配置持久磁盘和 `DB_PATH`。

选择支持Node.js24、HTTPS和持久磁盘的平台；构建命令为 `npm ci && npm run build`，启动命令为 `npm start`，健康检查为 `/api/health`。设置平台提供的 `PORT` 和持久磁盘路径对应的 `DB_PATH`。在HTTPS入口设置 `COOKIE_SECURE=1`。

平台若只有临时磁盘，重新部署后SQLite账号数据可能丢失，因此不能据此承诺持久化。创建付费实例、磁盘、域名之前需由用户确认费用。

## 发布前的实际限制

- 当前尚未部署到外部服务器，没有公网URL；云环境的“发布环境”功能只保存开发环境，不等同于发布网站。
- Binance在当前运行地区返回HTTP451，部署本身不保证解决；需在交易所允许的地区正常验证。
- 不上传本地演示数据库、原站登录凭据或浏览器会话。部署包会排除这些文件。
- Docker配置已准备，但当前云环境容器构建受DNS解析失败阻挡，镜像未构建成功。推荐的Render原生Node部署不使用Docker；原生安装、构建与生产启动已在开发环境验证。

## 启动时提示缺少前端页面

新版 `npm start` 会检查 `dist/index.html`；缺少时先自动执行Vite构建，成功后才启动后端。Vite列为生产依赖，即使平台使用 `npm ci --omit=dev` 也能构建。如果构建失败，启动流程会退出并保留错误日志，而不会把缺少前端的服务当作已上线。

Render已有服务需要先部署包含 `scripts/start.mjs` 的最新提交。若Start Command曾手动设置为 `node server/index.mjs`，请改为 `npm start` 才会执行这个自动构建流程。

## 后台自动行情

服务启动并监听端口后会立即开始采集，无需用户登录或点击连接。`MARKET_AUTO_SYNC=1`（默认）开启，`MARKET_REFRESH_SECONDS=60`设置周期，`MARKET_SYMBOL_LIMIT=20`设置扫描范围（最多200）。成功扫描后将已验证行情及K线缓存存入SQLite；重启后可恢复缓存并标记过期状态。

页面默认实时模式，每10秒只读取后台结果，不触发新的上游扫描；手动刷新仍需要本地账号，并与后台共用同一个采集任务，避免并发重复采集。历史快照需通过下拉菜单明确选择。连接失败时显示错误与下一次尝试时间，不会自动填入历史价格。

- AI选币、均线图、TD Setup使用本地指标计算。
- 大额监听统计最近24小时已收盘5m K线中达到成交额门槛的记录，默认100万USDT；不宣称与原站的内部“异常”算法相同。
- 实时多空比展示Binance全球账户多空比，以及5m、30m和4h变化。Binance没有在这些接口提供大户平均开仓价，因此不会虚构原站的这些字段。
- KOL、文章、人工策略仍为历史内容；它们需要单独的数据供应商或内容管理，不会通过行情接口自动生成。
- HTTP451地区限制退避1小时，429限流至少5分钟，普通错误逐步退避。不会自动切换到其他交易所来冒充Binance。
- Render免费实例休眠期间，后台任务也暂停。唤醒后会恢复采集，但这不是24小时持续采集方案；长期运行需要用户自行选择不休眠的部署资源，并确认费用。

检查真实线上状态：打开服务网址下的 `/api/market/status`。`automatic:true`表示后台定时任务已启用；只有 `ready:true`、`stale:false` 且 `updatedAt`持续变化，才能认为实时行情已接通。`/api/health`健康并不代表交易所连接成功。

## 切换交易所

当前版本默认使用OKX公开USDT永续合约数据，`MARKET_EXCHANGE=okx`；设置为 `binance` 可显式切回Binance。不会在失败时静默切换数据源。账号、交易API Key和交易权限均不需要。

OKX适配使用 `https://www.okx.com/api/v5/public/instruments`、`/api/v5/market/tickers` 和 `/api/v5/market/candles`。按时间戳分页取得最多700根K线，排除 `confirm=0` 的未收盘记录。成交量采用基础币数量，USDT成交额采用接口实际的 `volCcyQuote`，不把合约张数当作USDT成交额。

OKX币种排序使用24小时基础币成交量乘最新价的成交额估算值；其排序和Binance的实际24小时USDT成交额可能不同。价格、币种池、指标信号与原站不能据此宣称完全一致。

缓存按数据源隔离：不会把原来Binance缓存标为OKX实时数据。OKX账户多空比尚未接入，因此该页会显示不支持提示，不会生成假的账户占比。

请以实际线上 `/api/market/status` 的 `source`、`ready` 和时间戳判断是否接通。适配器及单元测试通过，不等同于上游已实际连接。

### Binance 全量采集配置

`deploy/binance-full.env.example` 提供独立配置，不会改变当前 OKX 预览服务。
启用前先从目标主机验证 Binance 正常提供服务；HTTP 451 需要使用交易所允许的部署环境，增加请求量无法解决。
`MARKET_SYMBOL_LIMIT=all` 扫描交易所当前处于 TRADING 状态的 USDT 永续合约，不包含全部现货与其他保证金币种。
默认每币种预热三个周期（3m、5m、15m），每周期1000根已收盘K线；支持210至1500根滚动窗口，不是多年历史归档。
请求按分钟权重和账户多空比五分钟预算排队，遇429/418继续退避。首次全量扫描可能持续数分钟，前端显示逐步完成进度；每轮完成后再等待刷新间隔，不保证所有币种每60秒完成更新。
K线按交易所、币种、周期单独存入SQLite，内存默认仅保留60个K线序列；重新启动可复用磁盘缓存。数据持久化需要真实挂载的持久磁盘。Render免费实例休眠、临时磁盘不适合持续大规模采集。
每50个币种及每轮结束保存扫描结果；状态接口提供 universeCount、progress、historyBars、memorySeriesCount、staleSymbolCount。单币种失败保留其旧缓存，并标记过期数量。
