"""Validate real inference output and atomically publish one JSON artifact."""
import argparse
import datetime as dt
import json
import math
import os
from pathlib import Path
import tempfile

FEATURES = ['open', 'high', 'low', 'close', 'volume', 'amount']

def validate(data):
    meta = data['metadata']
    assert meta['context'] == 512 and meta['horizon'] == 24, 'wrong context/horizon'
    assert meta['model'] == 'NeoQuasar/Kronos-small', 'wrong model'
    assert len(data['history']) == 512, 'wrong history count'
    assert 2 <= len(data['paths']) <= 20 and len(data['paths']) == meta['paths'], 'wrong path count'
    step = {'15m': 900, '1h': 3600, '4h': 14400, '1d': 86400}[meta['interval']]
    def timestamp(value):
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).replace(tzinfo=dt.timezone.utc).timestamp()
    for series in [data['history'], *data['paths']]:
        assert len(series) == (512 if series is data['history'] else 24)
        for row in series:
            assert all(isinstance(row[k], (int, float)) and not isinstance(row[k], bool) and math.isfinite(row[k]) for k in FEATURES), 'non-finite feature'
        assert all(timestamp(b['timestamps']) - timestamp(a['timestamps']) == step for a, b in zip(series, series[1:])), 'non-contiguous timestamps'
    for series in data['paths']:
        assert timestamp(series[0]['timestamps']) - timestamp(data['history'][-1]['timestamps']) == step, 'wrong prediction start'
        assert [r['timestamps'] for r in series] == [r['timestamps'] for r in data['paths'][0]], 'inconsistent path timestamps'
    assert len({tuple(r['close'] for r in p) for p in data['paths']}) > 1, 'all paths identical'
    return data

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--destination', type=Path, default=Path(__file__).parent / 'results' / 'forecast.json')
    args = parser.parse_args()
    data = validate(json.loads(args.input.read_text()))
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp = tempfile.mkstemp(prefix='.forecast-', dir=args.destination.parent)
    try:
        with os.fdopen(descriptor, 'w') as stream:
            json.dump(data, stream, allow_nan=False, ensure_ascii=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, args.destination)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)
    print(f'Published {len(data["paths"])} distinct sampled paths: {args.destination}')

if __name__ == '__main__':
    main()
