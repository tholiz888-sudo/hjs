"""Free CPU Gradio service: real Binance data and pinned Kronos-small."""
import functools
import json
import os
import shutil
from pathlib import Path
import tempfile
import threading
import time

os.environ.setdefault('GRADIO_ANALYTICS_ENABLED', 'False')
os.environ.setdefault('XDG_CACHE_HOME', str(Path(tempfile.gettempdir()) / 'kronos-xdg'))
os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir()) / 'kronos-mpl'))
import gradio as gr
import numpy as np
import pandas as pd
import requests
import torch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from model import Kronos, KronosTokenizer, KronosPredictor

FEATURES = ['open', 'high', 'low', 'close', 'volume', 'amount']
SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']
INTERVALS = ['15m', '1h', '4h', '1d']
MODEL_REV = '901c26c1332695a2a8f243eb2f37243a37bea320'
TOKENIZER_REV = '0e0117387f39004a9016484a186a908917e22426'
LOCK = threading.Lock()
OUTPUT_ROOT = Path(tempfile.mkdtemp(prefix='kronos-jobs-'))
torch.set_num_threads(2)


def fetch_candles(symbol, interval, session=requests):
    if symbol not in SYMBOLS or interval not in INTERVALS:
        raise ValueError('交易对或周期无效')
    endpoints = ['https://data-api.binance.vision', 'https://api.binance.com']
    errors = []
    for endpoint in endpoints:
        try:
            response = session.get(endpoint + '/api/v3/klines', params={'symbol': symbol, 'interval': interval, 'limit': 513}, timeout=20)
            response.raise_for_status()
            rows = response.json()
            if not isinstance(rows, list):
                raise ValueError('行情接口未返回 K 线列表')
            now_ms = time.time() * 1000
            closed = [r for r in rows if isinstance(r, list) and len(r) >= 8 and int(r[6]) < now_ms]
            frame = pd.DataFrame([dict(timestamps=pd.to_datetime(int(r[0]), unit='ms'), open=float(r[1]), high=float(r[2]), low=float(r[3]), close=float(r[4]), volume=float(r[5]), amount=float(r[7])) for r in closed]).tail(512).reset_index(drop=True)
            if len(frame) != 512 or not np.isfinite(frame[FEATURES].to_numpy()).all():
                raise ValueError('没有获取到 512 根有效、已收盘的 K 线')
            if not frame.timestamps.diff().dropna().eq(pd.Timedelta(interval)).all():
                raise ValueError('行情 K 线缺失、重复或未按时间排序')
            if (frame[['open', 'high', 'low', 'close']] <= 0).any().any() or (frame[['volume', 'amount']] < 0).any().any():
                raise ValueError('行情存在无效价格或成交量')
            if (frame.high < frame[['open', 'close', 'low']].max(axis=1)).any() or (frame.low > frame[['open', 'close', 'high']].min(axis=1)).any():
                raise ValueError('行情最高价、最低价关系无效')
            return frame, endpoint
        except (requests.RequestException, ValueError, TypeError, KeyError, IndexError, OverflowError) as error:
            # Public endpoint + error class only: no request headers or credentials.
            errors.append(f'{endpoint}: {type(error).__name__}')
    raise RuntimeError('无法访问币安真实行情，请稍后重试。当前未生成预测。' + '；'.join(errors))


@functools.lru_cache(maxsize=1)
def load_predictor():
    tokenizer = KronosTokenizer.from_pretrained('NeoQuasar/Kronos-Tokenizer-base', revision=TOKENIZER_REV)
    model = Kronos.from_pretrained('NeoQuasar/Kronos-small', revision=MODEL_REV)
    tokenizer.eval()
    model.eval()
    return KronosPredictor(model, tokenizer, device='cpu', max_context=512)


def generate(symbol, interval, path_count, seed, progress=gr.Progress()):
    if symbol not in SYMBOLS or interval not in INTERVALS:
        raise gr.Error('请选择支持的交易对和周期')
    if int(path_count) != path_count or not 2 <= int(path_count) <= 5:
        raise gr.Error('路径数量必须为 2–5')
    if int(seed) != seed or not 0 <= int(seed) <= 2147483647:
        raise gr.Error('随机种子必须为 0–2147483647 的整数')
    with LOCK:
        try:
            progress(.05, desc='读取 512 根真实已收盘 K 线')
            frame, source = fetch_candles(symbol, interval)
            progress(.15, desc='加载模型；首次运行需要下载，请耐心等待')
            predictor = load_predictor()
            torch.manual_seed(int(seed))
            future = pd.Series(pd.date_range(frame.timestamps.iloc[-1] + pd.Timedelta(interval), periods=24, freq=pd.Timedelta(interval)))
            outputs = []
            with torch.inference_mode():
                for i in range(int(path_count)):
                    progress(.2 + .7 * i / int(path_count), desc=f'生成独立路径 {i+1}/{int(path_count)}')
                    pred = predictor.predict(frame[FEATURES], frame.timestamps, future, pred_len=24, T=1., top_p=.9, sample_count=1, verbose=False)
                    if pred.shape != (24, 6) or not np.isfinite(pred.to_numpy()).all():
                        raise ValueError('模型返回无效数值')
                    pred.index.name = 'timestamps'
                    outputs.append(pred)
            if len({tuple(p.close) for p in outputs}) < 2:
                raise ValueError('采样路径完全相同，请更换随机种子后重试')
            progress(.95, desc='整理图表和下载文件')
            previous = sorted(OUTPUT_ROOT.glob('run-*'), key=lambda p: p.stat().st_mtime)
            for old in previous[:-19]:
                shutil.rmtree(old)
            output = Path(tempfile.mkdtemp(prefix='run-', dir=OUTPUT_ROOT))
            fig, ax = plt.subplots(figsize=(12, 5))
            try:
                ax.plot(frame.timestamps.tail(96), frame.close.tail(96), color='black', label='History')
                for i, pred in enumerate(outputs):
                    ax.plot(pd.concat([pd.Series([frame.timestamps.iloc[-1]]), future]), [frame.close.iloc[-1], *pred.close], alpha=.7, label=f'Sample {i+1}')
                ax.axvline(frame.timestamps.iloc[-1], color='grey', linestyle='--')
                ax.set(title=f'{symbol} {interval}: 24 future candles / {int(path_count)} paths', xlabel='UTC — sampled scenarios, not calibrated probabilities', ylabel='Price')
                ax.legend()
                fig.autofmt_xdate()
                fig.tight_layout()
                fig.savefig(output / 'forecast.png', dpi=130)
            finally:
                plt.close(fig)
            samples = np.stack([p.close.to_numpy() for p in outputs])
            summary = pd.DataFrame({'时间（北京时间）': future.dt.tz_localize('UTC').dt.tz_convert('Asia/Shanghai').dt.strftime('%Y-%m-%d %H:%M'), '样本最低': samples.min(axis=0), '样本中位数': np.median(samples, axis=0), '样本最高': samples.max(axis=0)})
            combined = pd.concat([pred.reset_index().assign(path=i+1) for i, pred in enumerate(outputs)], ignore_index=True)
            combined.to_csv(output / 'paths.csv', index=False)
            payload = {'metadata': {'source': source + ' (closed candles)', 'symbol': symbol, 'interval': interval, 'paths': int(path_count), 'seed': int(seed), 'context': 512, 'horizon': 24, 'model': 'NeoQuasar/Kronos-small', 'model_revision': MODEL_REV, 'tokenizer_revision': TOKENIZER_REV, 'time_basis': 'UTC', 'last_closed_open_time_utc': str(frame.timestamps.iloc[-1]), 'generated_at_utc': pd.Timestamp.now(tz='UTC').isoformat()}, 'history': json.loads(frame.to_json(orient='records', date_format='iso')), 'paths': [json.loads(p.reset_index().to_json(orient='records', date_format='iso')) for p in outputs]}
            (output / 'forecast.json').write_text(json.dumps(payload, allow_nan=False))
            last = frame.timestamps.iloc[-1].tz_localize('UTC').tz_convert('Asia/Shanghai').strftime('%Y-%m-%d %H:%M')
            yield str(output / 'forecast.png'), summary, [str(output / 'paths.csv'), str(output / 'forecast.json'), str(output / 'forecast.png')], f'已生成 {int(path_count)} 条独立路径。最后历史 K 线开盘时间：{last}（北京时间）。这不是经过校准的风险概率。'
        except Exception as error:
            if isinstance(error, RuntimeError) and str(error).startswith('无法访问币安'):
                message = str(error)
            else:
                message = f'生成失败（{type(error).__name__}）。请确认模型文件可下载后重试；未生成替代数据。'
            # Clear previous output on failure, avoiding stale chart mistaken for new prediction.
            yield None, None, None, message


def build_ui():
    with gr.Blocks(title='Kronos 免费在线预测', delete_cache=(3600, 3600)) as demo:
        gr.Markdown('# Kronos · 免费在线预测\n选择交易对和周期，点击生成。使用 **512 根已收盘 K 线**，采样未来 **24 根**。首次加载模型和免费服务唤醒可能较慢。')
        with gr.Row():
            symbol = gr.Dropdown(SYMBOLS, value='BTCUSDT', label='交易对')
            interval = gr.Dropdown(INTERVALS, value='1h', label='K 线周期')
            count = gr.Slider(2, 5, value=3, step=1, label='独立路径数')
            seed = gr.Number(value=42, precision=0, label='随机种子')
        button = gr.Button('生成未来 24 根预测', variant='primary')
        status = gr.Textbox(label='生成状态', value='等待生成；没有预填或模拟预测。', interactive=False)
        chart = gr.Image(type='filepath', label='多条预测路径（图表时间为 UTC）')
        table = gr.Dataframe(label='24 根采样收盘价范围（北京时间）', interactive=False)
        files = gr.File(label='下载 CSV / JSON / PNG', file_count='multiple')
        gr.Markdown('免费 CPU 服务可能休眠、排队或暂停。不连接交易账户，无需交易密钥。样本最小/最大不是校准置信区间，预测未经过交易效果验证，不构成买卖建议。')
        button.click(generate, [symbol, interval, count, seed], [chart, table, files, status], concurrency_limit=1, api_name=False)
    return demo.queue(max_size=3, default_concurrency_limit=1)

if __name__ == '__main__':
    build_ui().launch(server_name='0.0.0.0', server_port=int(os.environ.get('PORT', 7860)), show_error=False)
