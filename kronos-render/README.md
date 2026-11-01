# Kronos 免费 Render 展示页

本功能接入现有 Node 24 网站，地址为 `/kronos/`，首页顶栏有入口。Render 只提供静态结果，**无需安装 Python、PyTorch 或模型，不增加付费服务**。原 `render.yaml` 保持不变。结果不会实时更新；缺少真实结果时明确显示尚未生成。

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
