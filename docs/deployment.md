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
