# Kronos 免费 Render 展示页

本功能接入现有 Node 24 网站，使用 GitHub Actions 在线生成，也保留本地生成方式。地址为 `/kronos/`，首页顶栏有入口。Render 只提供静态结果，**无需安装 Python、PyTorch 或模型，不增加付费服务**。原 `render.yaml` 保持不变。结果不会实时更新；缺少真实结果时明确显示尚未生成。



## Kronos 设置后台

入口：https://hjs-4.onrender.com/kronos/admin （转到 `/crypto/admin/kronos`）。统一后台左侧也有“Kronos 预测后台”。复用已有管理员登录和权限；普通用户及未登录访问不能改设置、删除记录或导入数据。不提供默认管理员账号或密码。首次管理员初始化沿用统一后台登录页的现有说明。

- 展示设置：标题、说明、默认图表视图、采样范围带、中位线、涨跌幅对比、数值表格开关。
- 推荐参数：交易对、周期、路径数显示在前台。**这不是在线触发器，GitHub 工作流中仍需手动选择参数**，无需给网站配置 GitHub Token 或生成口令。
- 历史管理：查看、设为首页展示、导出单份、导入预测、删除非当前记录。前台可切换历史查看，不会改变全站默认展示。
- 备份迁移：导出完整 JSON；导入时默认合并历史并应用备份设置，可明确勾选完整替换。数据先全部校验，再用事务恢复，失败不会部分覆盖。备份不包含管理员账号、密码、模型权重或 GitHub 凭据。

设置和管理状态使用 Node 24 内置 SQLite，位置可通过平台无关的 `KRONOS_DB_PATH` 设置，默认在 `DATA_DIR/kronos.sqlite` 或项目 `.local/kronos.sqlite`。本模块不增加 npm 依赖。

**Render Free 的限制：重部署/实例重建可能清空本地 SQLite。请在保存重要改动后导出备份。** 随代码归档的生成结果会在启动时载入；后台自行导入的记录、删除标记、设置与展示选择需要备份保留。在有持久文件系统的平台可保留 SQLite 或导出后在新平台导入；管理员登录账户需沿用或另行迁移既有网站身份系统，不包含在此模块备份中。

GitHub 发布脚本现在自动将每次真实结果归档到 `results/history/forecast-<hash>.json` 并保留最近 50 份，不重复触发预测任务。本次也已从已有 Git 历史提取 3 份真实生成记录作为初始历史。SQLite 历史最多保留 50 条；当前展示受保护。删除标记会在同一个数据库中阻止随代码记录重启后再次出现。默认自动展示最新记录，“设为展示”会切换到固定历史模式，重新勾选自动最新即可恢复。

## 当前免费在线方案：GitHub Actions

首轮真实任务已成功：[GitHub Actions #2](https://github.com/tholiz888-sudo/hjs/actions/runs/41311535915)。实际生成 BTCUSDT / 1h，512 根已收盘历史 K 线和 3 条不同的未来 24 根路径，生成时间为 2026-11-01 13:31:50 UTC。结果已提交到 Render 绑定分支，已用本地 HTTP 请求及网页渲染逻辑验证读取、24 行汇总和 3 条路径绘制。Render 线上部署状态仍无法从当前云环境核验。此次功能验证不代表预测准确率验证。

现有 hjs 仓库已通过 GitHub 仓库页面确认是 Public。GitHub 标准 runner 用于公开仓库的规则见官方 GitHub Actions 计费文档；此任务强制公开仓库才运行，固定 ubuntu-latest 标准 runner，最长 20 分钟，不使用付费大型 runner，不设置定时任务。

**不需要 Hugging Face 账号、Space 或 PRO。** 之前的 HF Spaces CPU 免费方案已被用户实际创建页面否定，`hf-space/` 仅保留为历史备选，不是本方案的依赖。

1. 打开 https://github.com/tholiz888-sudo/hjs/actions/workflows/kronos-forecast.yml ，使用拥有仓库权限的 GitHub 账号登录。
2. 如 GitHub 提示启用 Actions，先启用。点击 **Run workflow**，选择 **main** 分支、交易对、周期和路径数，再点击运行。
3. 等待任务成功；第一次添加此工作流到 main 时会自动生成默认 BTCUSDT / 1h / 3 路径。
4. 任务先获取 512 根已收盘 Binance K 线并运行 Kronos-small，验证 24 步输出和路径差异；成功后只提交 `results/forecast.json` 到 Render 实际绑定的 **codex/kronos-render-free** 分支。
5. Render hjs-4 自动部署完成后打开 https://hjs-4.onrender.com/kronos/ 。如果自动部署未开启，在已有服务使用 Manual Deploy → Deploy latest commit。

工作流通过 `contents: write` 使用 GitHub 自带的临时 GITHUB_TOKEN 发布结果，不需要把密钥放入 Render。若仓库规则禁止 bot 推送，任务会报错，需要仓库维护者调整权限后重新运行。生成失败不会覆盖旧结果。

只有工作流文件变更推送到 main 才会自动运行；预测结果提交不会循环触发任务。所有后续生成均可手动触发。普通访客只查看结果，维护者负责运行，不开放匿名消耗计算的接口。账户或组织的 Actions 权限限制、平台可用性仍可能阻止运行；任务尚未成功前不能宣称预测已经生成。

行情使用 Binance 官方公开行情专用域名 `data-api.binance.vision`，失败时尝试 `api.binance.com`。不会生成模拟行情替代真实数据。只把验证后的 JSON 保留在 Git 中，网页可导出 CSV；不上传 Actions Artifact、不启用 Actions 缓存，避免额外存储计费。

## 在本地或云机器生成真实结果

需要 Python 3.12、Git、可访问 Hugging Face 和币安公开 API 的网络。脚本针对 Linux CPU；Windows 可在 WSL 运行。公开现货 K 线无需币安密钥。

```bash
bash kronos-render/generate.sh
```

默认 BTCUSDT、1 小时周期、512 根已收盘 K 线、未来 24 根、5 条独立路径。可以传 `--symbol ETHUSDT --interval 4h --paths 10`。每次调用 `sample_count=1` 保留独立采样，避免官方接口对多个样本求平均。固定模型和 tokenizer 的版本，默认随机种子 42。CPU 推理耗时取决于硬件。

脚本在 `.local/kronos/` 安装依赖和模型缓存（由现有 `.gitignore` 忽略），验证输出后原子更新 `kronos-render/results/forecast.json`。该文件只含公开行情和预测，可提交到 Git。模型文件、缓存和密钥不要提交。

云环境已有依赖时可复用：

```bash
KRONOS_REPO=/workspace/Kronos KRONOS_PYTHON=/workspace/kronos-venv/bin/python bash kronos-render/generate.sh
```

已安装依赖后也可直接调用 `forecast.py --output 输出目录`，然后 `python kronos-render/publish.py 输出目录/forecast.json`。`forecast.py` 还会输出 PNG、单条路径 CSV 和汇总 CSV。网页可下载全部路径 CSV。

## 部署到已有 Render 网站

1. 把此改动和实际生成的 `results/forecast.json` 推送到已有 Render 服务绑定的 GitHub 分支。
2. 保持现有服务的 Node 24、`npm run check` 构建命令、`npm start` 启动命令、原环境变量和免费计划。无需创建 Blueprint 或第二个服务。
3. 如未开启自动部署，在 Render 的已有服务中选择 Manual Deploy → Deploy latest commit。
4. 访问原域名下的 `/kronos/`，核对交易对、最后历史 K 线时间、生成时间、24 行汇总及 CSV。

重新生成并推送 JSON 才会更新预测。页面明确显示预生成状态；预测窗口过期会提示。时间按 Asia/Shanghai 展示，导出 CSV 用 UTC。样本最小/最大不是校准后的置信区间，不代表真实风险概率。

## 验证与当前限制

```bash
npm run check
npm test
python -m unittest discover -s kronos-render -p 'test_*.py'
```

发布校验检查 512 根历史、每条 24 根、等间隔时间、有限数值和至少两条不同路径；失败不覆盖上一份结果。合成测试数据只用于验证发布器，不会写入展示目录，也不代表预测准确。

初次配置期间，云环境代理对 Hugging Face 和 api.binance.com 返回 CONNECT 403。网络域名已写入云环境草稿，但需在环境设置保存并发布使其生效；在实际模型下载、真实行情及推理成功前，本功能不能称为完成真实预测。尚未验证 Render 线上部署；需确认服务 URL 和访问权限。
