# 链上研习社
蓝色门户模板，首页和栏目页三栏，文章详情页只有正文和右栏。包含 14 篇原创基础教程、搜索、手续费计算器、行情、RSS 标题和 RSI/EMA/量比观察。

## Render 部署
新建 Web Service，连接 `tholiz888-sudo/hjs`，选择 **crypto-site** 分支（该分支网站文件位于根目录）。运行环境 Node，Build Command `npm run check && npm test`，Start Command `npm start`，免费实例即可。部署成功后打开 Render 生成的网址。免费实例休眠后首次访问可能较慢。

若选择 main 分支，Root Directory 填 `crypto-site`。已有交易复盘服务仍可保留；main 分支的旧服务也挂载 `/crypto/` 预览入口。

## 配置站名、返佣、社群
编辑 `site-config.json`：name 站名、tagline 标语、contact 联系方式；social 的 telegram/x/wechat 填 HTTPS 地址；exchanges 中 referralUrl 填你获得授权的邀请地址、code 填邀请码、discountPercent 填经过官方确认的减免比例。未确认时保留 null，链接为空时按钮只去官网。提交后 Render 重新部署。不要填交易所账号密码或 API 密钥。

## 本地启动
安装 Node.js 24，然后在本文件夹打开终端运行 `npm start`，浏览器打开 http://localhost:3000 。不需要安装第三方依赖。修改源码后重启服务。

## 数据说明
行情在服务端请求 CoinGecko 或 OKX，缓存三分钟；浏览器每分钟检查更新。量化榜使用 OKX 已收盘 1H 数据，计算 Wilder RSI14、EMA20 和量比，并非 AI 模型预测。新闻读取 CoinDesk RSS 标题并链接原文，不转载正文。数据源可能限流或因所在地区不可用，页面会显示错误；已有缓存过期后请求失败，会明确标注旧数据。没有伪造行情或信号。

本版不含后台编辑器、付费订阅或 AI 模型调用。内容在 data.js 编辑；真实 AI 服务需另行配置模型和预算。搜索和教程无需外部接口，计算器在浏览器本地运行。

## 验证
`npm run check && npm test`。健康检查 `/health`；SEO 页面由服务端渲染，提供 sitemap.xml、robots.txt、文章 JSON-LD。Render 自动提供域名时会用于 canonical；自定义域名可设置 SITE_URL=https://你的域名。
