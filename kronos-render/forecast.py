"""Binance closed candles -> independent Kronos-small paths (CPU)."""
import argparse
import json
import os
from pathlib import Path
import sys

BASE = Path(__file__).resolve().parent
LOCAL = BASE.parent / '.local' / 'kronos'
os.environ.setdefault('HF_HOME', str(LOCAL / 'cache'))
os.environ.setdefault('MPLCONFIGDIR', str(LOCAL / 'matplotlib'))
sys.path.insert(0, os.environ.get('KRONOS_REPO', str(LOCAL / 'Kronos')))

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--symbol', default='BTCUSDT')
    p.add_argument('--interval', choices=['15m', '1h', '4h', '1d'], default='1h')
    p.add_argument('--paths', type=int, default=5)
    p.add_argument('--seed', type=int, default=42)
    p.add_argument('--csv', type=Path, help='Offline input with timestamps,OHLC,volume,amount')
    p.add_argument('--output', type=Path, default=LOCAL / 'results')
    a = p.parse_args()
    if not 2 <= a.paths <= 20:
        p.error('--paths must be 2..20')
    import numpy as np
    import pandas as pd
    import requests
    import torch
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from model import Kronos, KronosTokenizer, KronosPredictor
    torch.set_num_threads(4)
    torch.manual_seed(a.seed)
    np.random.seed(a.seed)
    step = pd.Timedelta(a.interval)
    if a.csv:
        frame = pd.read_csv(a.csv)
        frame['timestamps'] = pd.to_datetime(frame['timestamps'], utc=True).dt.tz_localize(None)
        source = str(a.csv)
    else:
        response = requests.get('https://api.binance.com/api/v3/klines', params={
            'symbol': a.symbol.upper(), 'interval': a.interval, 'limit': 513}, timeout=30)
        response.raise_for_status()
        rows = response.json()
        if not isinstance(rows, list):
            raise ValueError(f'Unexpected Binance response: {rows}')
        now_ms = pd.Timestamp.now(tz='UTC').timestamp() * 1000
        rows = [r for r in rows if r[6] < now_ms]
        frame = pd.DataFrame([{'timestamps': pd.to_datetime(r[0], unit='ms'),
            'open': float(r[1]), 'high': float(r[2]), 'low': float(r[3]),
            'close': float(r[4]), 'volume': float(r[5]), 'amount': float(r[7])} for r in rows])
        source = 'Binance spot API, closed candles only'
    frame = frame.tail(512).reset_index(drop=True)
    cols = ['open', 'high', 'low', 'close', 'volume', 'amount']
    if len(frame) != 512 or not np.isfinite(frame[cols].to_numpy()).all():
        raise ValueError('Require exactly 512 finite historical candles')
    if not frame.timestamps.diff().dropna().eq(step).all():
        raise ValueError('Historical candles must be ordered, unique and contiguous for --interval')
    a.output.mkdir(parents=True, exist_ok=True)
    frame.to_csv(a.output / 'history.csv', index=False)
    tokenizer = KronosTokenizer.from_pretrained('NeoQuasar/Kronos-Tokenizer-base', revision='0e0117387f39004a9016484a186a908917e22426')
    model = Kronos.from_pretrained('NeoQuasar/Kronos-small', revision='901c26c1332695a2a8f243eb2f37243a37bea320')
    model.eval()
    tokenizer.eval()
    predictor = KronosPredictor(model, tokenizer, device='cpu', max_context=512)
    future = pd.Series(pd.date_range(frame.timestamps.iloc[-1] + step, periods=24, freq=step))
    paths = []
    full_paths = []
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(frame.timestamps.tail(96), frame.close.tail(96), color='black', label='History')
    with torch.inference_mode():
        for i in range(a.paths):
            pred = predictor.predict(frame[cols], frame.timestamps, future, pred_len=24,
                T=1.0, top_p=0.9, sample_count=1, verbose=False)
            if pred.shape != (24, 6) or not np.isfinite(pred.to_numpy()).all():
                raise ValueError('Invalid model output')
            pred.index.name = 'timestamps'
            pred.to_csv(a.output / f'path_{i+1}.csv')
            paths.append(pred.close.to_numpy())
            full_paths.append(json.loads(pred.reset_index().to_json(orient='records', date_format='iso')))
            ax.plot(future, pred.close, alpha=.55, label=f'Sample {i+1}')
    summary = pd.DataFrame({'timestamps': future, 'sample_min': np.min(paths, axis=0),
        'sample_median': np.median(paths, axis=0), 'sample_max': np.max(paths, axis=0)})
    summary.to_csv(a.output / 'summary.csv', index=False)
    ax.set_title(f'{a.symbol} {a.interval}: 24 future candles / {a.paths} sampled paths')
    ax.set_xlabel('UTC (samples are not calibrated confidence intervals)')
    ax.set_ylabel('Price')
    ax.legend()
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(a.output / 'forecast.png', dpi=150)
    metadata = {'source': source, 'symbol': a.symbol,
        'interval': a.interval, 'seed': a.seed, 'paths': a.paths, 'context': 512, 'horizon': 24,
        'last_closed_open_time_utc': str(frame.timestamps.iloc[-1]),
        'warning': 'Sample dispersion is not a calibrated risk estimate or trading signal',
        'generated_at_utc': pd.Timestamp.now(tz='UTC').isoformat(),
        'model': 'NeoQuasar/Kronos-small',
        'model_revision': '901c26c1332695a2a8f243eb2f37243a37bea320',
        'tokenizer_revision': '0e0117387f39004a9016484a186a908917e22426',
        'time_basis': 'UTC'}
    (a.output / 'metadata.json').write_text(json.dumps(metadata, indent=2))
    payload = {'metadata': metadata,
        'history': json.loads(frame.to_json(orient='records', date_format='iso')),
        'paths': full_paths}
    (a.output / 'forecast.json').write_text(json.dumps(payload, allow_nan=False))
    print(f'Generated {a.paths} independent 24-candle paths in {a.output}')

if __name__ == '__main__':
    main()
