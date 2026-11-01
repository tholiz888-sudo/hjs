---
title: Kronos 免费在线预测
emoji: 📈
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 5.49.1
python_version: 3.12
app_file: app.py
pinned: false
license: mit
---

# Kronos-small 免费在线预测

使用免费的 CPU Basic 硬件，在网页选币种、周期并点击生成，输入 512 根已收盘 K 线，采样 2–5 条未来 24 根走势。无需交易密钥，不连接账户。

行情使用 Binance 官方公开行情专用域名 `data-api.binance.vision`，失败时尝试 `api.binance.com`。两者均无法访问时明确报错，不生成替代或模拟行情。模型和 tokenizer 从 Hugging Face 加载固定版本。第一次点击需要下载模型；免费服务可能休眠、排队或因平台资源限制暂停。免费额度和可用性以 Hugging Face 当前规则为准。

## 部署

1. 在 https://huggingface.co/new-space 创建一个公开 Gradio Space，选免费 CPU Basic（不要选择收费硬件）。
2. 将本目录内的全部文件及 `model/` 文件夹上传到 Space 仓库根目录，保留本 README 的 YAML 配置。
3. 等待构建完成，打开 App，先运行 BTCUSDT / 1h / 2 条路径，验证真实模型和行情访问。
4. 复制 Space 的直接应用地址 `https://用户名-space名称.hf.space`。在现有 Render 服务的 Environment 增加 `KRONOS_SPACE_URL`，值为这个地址，保存并重新部署。Render 首页 `/kronos/` 会嵌入在线服务；也可以直接使用 Space 页面，不必等待 Render 配置。

该服务公开、无付费后台或外部 API 密钥。任务排队执行，最多等待 3 个任务，避免并发推理耗尽免费 CPU。预测结果可下载 PNG、JSON 和 CSV，文件临时保存不承诺永久留存。样本分布不是经过校准的置信区间，也不是收益保证或交易信号。

## 来源

`model/` 原样复制自 https://github.com/shiyu-coder/Kronos ，commit `67b630e67f6a18c9e9be918d9b4337c960db1e9a`。保留原 MIT 许可证和版权。模型：`NeoQuasar/Kronos-small`，revision `901c26c1332695a2a8f243eb2f37243a37bea320`；tokenizer：`NeoQuasar/Kronos-Tokenizer-base`，revision `0e0117387f39004a9016484a186a908917e22426`。

此部署模板的界面和行情适配器可在本地测试，但只有 Space 实际完成模型下载、行情读取和预测后，才代表免费在线推理已验证。
