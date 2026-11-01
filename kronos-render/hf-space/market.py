"""Binance public market-data adapter; no keys, no model imports."""
import time
import numpy as np
import pandas as pd
import requests

FEATURES = ['open', 'high', 'low', 'close', 'volume', 'amount']
SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']
INTERVALS = ['15m', '1h', '4h', '1d']

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

