"""Adapter and workflow tests use synthetic fixtures; no real inference claim."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).parent))
from app import fetch_candles, generate, build_ui, FEATURES

class Response:
    def __init__(self, rows): self.rows = rows
    def raise_for_status(self): pass
    def json(self): return self.rows

class Session:
    def __init__(self, rows, fail_first=False): self.rows=rows; self.calls=[]; self.fail_first=fail_first
    def get(self, url, **kwargs):
        self.calls.append(url)
        if self.fail_first and len(self.calls)==1: raise requests.ConnectionError('test failure')
        return Response(self.rows)

class SpaceTests(unittest.TestCase):
    def rows(self):
        start=1767225600000
        return [[start+i*3600000,'100','102','99','101','10',start+(i+1)*3600000-1,'1000'] for i in range(513)]
    def test_fetch_closed_only_and_fallback(self):
        session=Session(self.rows(),fail_first=True)
        with patch('app.time.time',return_value=(1767225600000+512*3600000)/1000):
            frame,source=fetch_candles('BTCUSDT','1h',session)
        self.assertEqual(len(frame),512)
        self.assertEqual(frame.timestamps.iloc[0],pd.Timestamp('2026-01-01'))
        self.assertEqual(source,'https://api.binance.com')
        self.assertEqual(len(session.calls),2)
    def test_missing_candles_fail(self):
        rows=self.rows(); rows.pop(300)
        with self.assertRaises(RuntimeError):fetch_candles('BTCUSDT','1h',Session(rows))
    def test_generation_pipeline_and_error_clears_stale_results(self):
        import app
        frame,_=fetch_candles('BTCUSDT','1h',Session(self.rows()))
        class Predictor:
            count=0
            def predict(self,df,x,y,**kwargs):
                self.count+=1
                assert kwargs['sample_count']==1 and kwargs['pred_len']==24
                return pd.DataFrame(np.ones((24,6))*(100+self.count),index=y,columns=FEATURES)
        with tempfile.TemporaryDirectory() as folder,patch('app.OUTPUT_ROOT',Path(folder)),patch('app.fetch_candles',return_value=(frame,'SYNTHETIC TEST FIXTURE')),patch('app.load_predictor',return_value=Predictor()):
            result=list(generate('BTCUSDT','1h',2,42))[-1]
            self.assertTrue(Path(result[0]).exists())
            self.assertEqual(len(result[1]),24)
            self.assertEqual(len(result[2]),3)
            self.assertIn('2 条独立路径',result[3])
        with patch('app.fetch_candles',side_effect=RuntimeError('无法访问币安真实行情')):
            result=list(generate('BTCUSDT','1h',2,42))[-1]
            self.assertEqual(result[:3],(None,None,None))
            self.assertIn('无法访问币安',result[3])
    def test_ui_builds_with_single_worker_queue(self):
        demo=build_ui()
        self.assertEqual(demo._queue.max_size,3)
        self.assertIn('Kronos',demo.title)

if __name__=='__main__': unittest.main()
