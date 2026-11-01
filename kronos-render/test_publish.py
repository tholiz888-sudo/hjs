"""Synthetic fixtures test artifact validation only, never model accuracy."""
import copy
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from publish import validate

def fixture():
    start = dt.datetime(2026, 1, 1)
    def row(i, offset=0):
        return dict(timestamps=(start + dt.timedelta(hours=i)).isoformat(), open=100., high=102., low=99., close=100.+offset, volume=10., amount=1000.)
    return dict(metadata=dict(context=512, horizon=24, paths=2, interval='1h', model='NeoQuasar/Kronos-small'), history=[row(i) for i in range(512)], paths=[[row(i, j) for i in range(512,536)] for j in range(2)])

class PublishTest(unittest.TestCase):
    def test_valid_artifact_and_failure_preserves_published_result(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/'input.json'
            destination=Path(folder)/'results.json'
            data=fixture()
            source.write_text(json.dumps(data))
            command=[sys.executable,str(Path(__file__).with_name('publish.py')),str(source),'--destination',str(destination)]
            subprocess.run(command,check=True,capture_output=True)
            previous=destination.read_bytes()
            data['paths'][0].pop()
            source.write_text(json.dumps(data))
            self.assertNotEqual(subprocess.run(command,capture_output=True).returncode,0)
            self.assertEqual(destination.read_bytes(),previous)
    def test_rejects_corrupted_and_identical_paths(self):
        for mutation in ['nan','gap','identical','start']:
            data=copy.deepcopy(fixture())
            if mutation=='nan':data['paths'][0][0]['close']=float('nan')
            elif mutation=='gap':data['history'][1]['timestamps']=data['history'][0]['timestamps']
            elif mutation=='identical':data['paths'][1]=copy.deepcopy(data['paths'][0])
            else:data['paths'][0][0]['timestamps']=data['history'][-1]['timestamps']
            with self.subTest(mutation=mutation),self.assertRaises(AssertionError):validate(data)

if __name__=='__main__':unittest.main()
