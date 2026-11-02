"""Deterministic math/time-alignment fixtures only; no market accuracy claim."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
import requests
from test_publish import fixture
from evaluate import assess, fetch_actual, evaluate_directory, key_for, milliseconds

STEP=3600000

def forecast():
    value=fixture();value['metadata'].update(symbol='BTCUSDT',generated_at_utc=value['paths'][0][0]['timestamps'])
    return value

class Response:
    def __init__(self,rows):self.rows=rows
    def raise_for_status(self):pass
    def json(self):return self.rows
class Session:
    def __init__(self,rows=None,fail=False):self.rows=rows;self.fail=fail;self.calls=0
    def get(self,*args,**kwargs):
        self.calls+=1
        if self.fail:raise requests.ConnectionError('fixture transport error')
        return Response(self.rows)

class EvaluationTests(unittest.TestCase):
    def test_complete_metrics_are_fixed_median_and_constant_price_baseline(self):
        value=forecast();before=copy.deepcopy(value);start=milliseconds(value['paths'][0][0]['timestamps']);actual={start+i*STEP:101. for i in range(24)}
        report=assess(value,actual,start+24*STEP)
        self.assertEqual(report['state'],'complete');self.assertEqual(report['mae'],.5);self.assertEqual(report['baseline_mae'],1.)
        self.assertTrue(report['beats_baseline']);self.assertTrue(report['direction_hit']);self.assertEqual(report['sample_coverage_pct'],100.)
        self.assertEqual(report['path_mae'],[1.,0.]);self.assertAlmostEqual(report['mape_pct'],.5/101*100)
        self.assertEqual(value,before)
    def test_future_candles_and_preissuance_outcomes_do_not_enter_scores(self):
        value=forecast();start=milliseconds(value['paths'][0][0]['timestamps']);actual={start+i*STEP:101. for i in range(24)}
        report=assess(value,actual,start+5*STEP)
        self.assertEqual(report['matched_count'],5);self.assertEqual(report['scored_count'],5);self.assertIsNone(report['direction_hit']);self.assertEqual(report['state'],'partial');self.assertIsNone(report['rows'][5]['actual_close'])
        value['metadata']['generated_at_utc']=value['paths'][0][2]['timestamps'];report=assess(value,actual,start+24*STEP)
        self.assertEqual(report['excluded_count'],2);self.assertEqual(report['scored_count'],22);self.assertFalse(report['fully_forward']);self.assertIsNone(report['direction_hit'])
        actual.pop(start+3*STEP);report=assess(forecast(),actual,start+24*STEP);self.assertEqual(report['state'],'incomplete_data');self.assertIsNone(report['direction_hit'])
    def test_actual_adapter_discards_open_candle_and_rejects_duplicate(self):
        value=forecast();start=milliseconds(value['paths'][0][0]['timestamps']);rows=[[start+i*STEP,'100','102','99','101','10',start+(i+1)*STEP-1,'1000'] for i in range(24)]
        actual,_=fetch_actual(value,start+5*STEP,Session(rows));self.assertEqual(len(actual),5)
        with self.assertRaises(RuntimeError):fetch_actual(value,start+24*STEP,Session(rows+[rows[0]]))
    def test_failed_refresh_preserves_old_report_with_stale_flag(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);value=forecast();(root/'forecast.json').write_text(json.dumps(value));key=key_for(value)
            before=(root/'forecast.json').read_bytes();old={'entries':{key:{'state':'partial','matched_count':1,'checked_at_utc':'2026-01-01T00:00:00Z','rows':[{'fixture':True}]}}}
            report=evaluate_directory(root,old,Session(fail=True),milliseconds(value['paths'][0][-1]['timestamps'])+STEP)
            self.assertTrue(report['entries'][key]['fetch_error']);self.assertEqual(report['entries'][key]['checked_at_utc'],'2026-01-01T00:00:00Z');self.assertEqual(before,(root/'forecast.json').read_bytes())
    def test_submillisecond_generation_time_key_matches_browser_precision(self):
        value=forecast();value['metadata']['generated_at_utc']='2026-01-01T00:00:00.123999+00:00'
        self.assertIn('|1767225600123|',key_for(value))

if __name__=='__main__':unittest.main()
