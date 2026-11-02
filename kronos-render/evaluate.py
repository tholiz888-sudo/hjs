"""Compare saved forecasts to later closed candles. Never regenerate predictions."""
import argparse
import datetime as dt
import json
import math
import os
from pathlib import Path
import statistics
import tempfile
import time
import requests
from publish import validate

STEPS = {'15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000}

def milliseconds(value):
    stamp = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=dt.timezone.utc)
    delta = stamp.astimezone(dt.timezone.utc) - dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc)
    return delta.days * 86400000 + delta.seconds * 1000 + delta.microseconds // 1000

def key_for(data):
    m = data['metadata']
    return '|'.join(map(str, [m['symbol'], m['interval'], milliseconds(m['generated_at_utc']), milliseconds(data['paths'][0][0]['timestamps']), len(data['paths'])]))

def fetch_actual(data, as_of_ms, session=requests):
    m = data['metadata']
    if m['symbol'] not in ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'] or m['interval'] not in STEPS:
        raise ValueError('unsupported market')
    step = STEPS[m['interval']]
    targets = {milliseconds(row['timestamps']) for row in data['paths'][0]}
    start, end = min(targets), max(targets) + step - 1
    if start + step > as_of_ms:
        return {}, None
    errors = []
    for endpoint in ['https://data-api.binance.vision', 'https://api.binance.com']:
        try:
            response = session.get(endpoint + '/api/v3/klines', params={'symbol': m['symbol'], 'interval': m['interval'], 'startTime': start, 'endTime': min(end, as_of_ms - 1), 'limit': 24}, timeout=12)
            response.raise_for_status()
            rows = response.json()
            if not isinstance(rows, list):
                raise ValueError('unexpected response')
            result = {}
            for row in rows:
                if not isinstance(row, list) or len(row) < 8:
                    raise ValueError('malformed candle')
                opened, closed, close = int(row[0]), int(row[6]), float(row[4])
                if opened not in targets:
                    continue
                if closed != opened + step - 1 or not math.isfinite(close) or close <= 0:
                    raise ValueError('invalid close or interval')
                if closed >= as_of_ms:
                    continue
                if opened in result:
                    raise ValueError('duplicate candle')
                result[opened] = close
            return result, endpoint
        except (requests.RequestException, ValueError, TypeError, IndexError, OverflowError) as error:
            errors.append(type(error).__name__)
    raise RuntimeError('actual market data unavailable: ' + ', '.join(errors))

def assess(data, actual, as_of_ms):
    validate(data)
    m = data['metadata']; step = STEPS[m['interval']]
    issued = milliseconds(m['generated_at_utc']); base = float(data['history'][-1]['close'])
    if not math.isfinite(base) or base <= 0:
        raise ValueError('invalid historical baseline')
    rows = []
    for i, target in enumerate(data['paths'][0]):
        opened = milliseconds(target['timestamps']); values = [float(p[i]['close']) for p in data['paths']]
        observed = actual.get(opened) if opened + step <= as_of_ms else None
        rows.append({'timestamps': target['timestamps'], 'predicted_median': statistics.median(values), 'sample_min': min(values), 'sample_max': max(values), 'actual_close': observed, 'eligible': opened + step - 1 > issued})
    matched = [r for r in rows if r['actual_close'] is not None]
    scored = [r for r in matched if r['eligible']]
    expected_closed = sum(milliseconds(r['timestamps']) + step <= as_of_ms for r in rows)
    state = 'complete' if len(matched) == 24 else 'incomplete_data' if expected_closed > len(matched) else 'partial' if matched else 'pending'
    mae = statistics.mean(abs(r['predicted_median']-r['actual_close']) for r in scored) if scored else None
    baseline_mae = statistics.mean(abs(base-r['actual_close']) for r in scored) if scored else None
    mape = statistics.mean(abs(r['predicted_median']-r['actual_close'])/r['actual_close']*100 for r in scored) if scored else None
    coverage = sum(r['sample_min'] <= r['actual_close'] <= r['sample_max'] for r in scored)/len(scored)*100 if scored else None
    terminal = rows[-1]; eligible = all(r['eligible'] for r in rows)
    sign = lambda value: (value > 0) - (value < 0)
    hit = sign(terminal['predicted_median']-base) == sign(terminal['actual_close']-base) if state == 'complete' and eligible else None
    path_mae = [statistics.mean(abs(p[i]['close']-r['actual_close']) for i, r in enumerate(rows) if r['actual_close'] is not None and r['eligible']) for p in data['paths']] if scored else []
    return {'key': key_for(data), 'symbol': m['symbol'], 'interval': m['interval'], 'generated_at_utc': m['generated_at_utc'], 'state': state, 'matched_count': len(matched), 'scored_count': len(scored), 'expected_closed': expected_closed, 'excluded_count': sum(not r['eligible'] for r in rows), 'fully_forward': eligible, 'baseline_close': base, 'mae': mae, 'baseline_mae': baseline_mae, 'mape_pct': mape, 'sample_coverage_pct': coverage, 'beats_baseline': mae < baseline_mae if mae is not None else None, 'direction_hit': hit, 'predicted_terminal_return_pct': (terminal['predicted_median']/base-1)*100, 'actual_terminal_return_pct': (terminal['actual_close']/base-1)*100 if terminal['actual_close'] is not None else None, 'path_mae': path_mae, 'rows': rows}

def evaluate_directory(root, previous=None, session=requests, as_of_ms=None):
    as_of_ms = int(time.time()*1000) if as_of_ms is None else as_of_ms
    files = sorted((root/'history').glob('forecast-*.json')) + ([root/'forecast.json'] if (root/'forecast.json').exists() else [])
    forecasts = {}
    for file in files:
        value = validate(json.loads(file.read_text()))
        forecasts[key_for(value)] = value
    entries = {}; cache = {}; deadline = time.monotonic() + 480
    for key, data in forecasts.items():
        try:
            if time.monotonic() > deadline:
                raise RuntimeError('validation time budget exhausted')
            m = data['metadata']; times = data['paths'][0]
            group = (m['symbol'], m['interval'], times[0]['timestamps'], times[-1]['timestamps'])
            if group not in cache:
                cache[group] = fetch_actual(data, as_of_ms, session)
            actual, source = cache[group]
            entry = assess(data, actual, as_of_ms)
            entry.update({'source': source, 'checked_at_utc': dt.datetime.fromtimestamp(as_of_ms/1000, tz=dt.timezone.utc).isoformat(), 'fetch_error': False})
            entries[key] = entry
        except Exception as error:
            old = (previous or {}).get('entries', {}).get(key)
            if old:
                entries[key] = {**old, 'fetch_error': True, 'error': type(error).__name__}
            else:
                entries[key] = {'key': key, 'symbol': data['metadata']['symbol'], 'interval': data['metadata']['interval'], 'state': 'unavailable', 'fetch_error': True, 'error': type(error).__name__, 'rows': []}
    return {'version': 1, 'as_of_utc': dt.datetime.fromtimestamp(as_of_ms/1000, tz=dt.timezone.utc).isoformat(), 'forecast_count': len(entries), 'complete_forward_count': sum(e.get('state') == 'complete' and e.get('fully_forward') and not e.get('fetch_error') for e in entries.values()), 'entries': entries}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).parent/'results')
    parser.add_argument('--output', type=Path, default=Path(__file__).parent/'results/evaluations.json')
    args = parser.parse_args()
    previous = json.loads(args.output.read_text()) if args.output.exists() else None
    report = evaluate_directory(args.root, previous)
    if report['entries'] and all(e.get('fetch_error') for e in report['entries'].values()):
        raise RuntimeError('All actual-price requests failed; previous report remains unchanged')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp = tempfile.mkstemp(dir=args.output.parent, prefix='.evaluations-')
    try:
        with os.fdopen(descriptor, 'w') as stream:
            json.dump(report, stream, allow_nan=False)
            stream.flush(); os.fsync(stream.fileno())
        os.replace(temp, args.output)
    finally:
        if os.path.exists(temp): os.unlink(temp)
    print(f"Validated {report['forecast_count']} saved forecasts; {report['complete_forward_count']} fully completed forward windows")

if __name__ == '__main__': main()
