"""Exercise publication against a local bare Git remote, with test-only data."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from test_publish import fixture

BASE = Path(__file__).parent

def git(folder, *args):
    return subprocess.check_output(['git', '-C', str(folder), *args], text=True, stderr=subprocess.STDOUT).strip()

class PublicationTest(unittest.TestCase):
    def test_only_data_is_published_and_dirty_code_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); remote=root/'remote.git'; work=root/'work'; runner=root/'runner';runner.mkdir()
            subprocess.run(['git','init','--bare',str(remote)],check=True,capture_output=True)
            subprocess.run(['git','clone',str(remote),str(work)],check=True,capture_output=True)
            git(work,'config','user.email','test@example.invalid');git(work,'config','user.name','Test')
            git(work,'checkout','-b','codex/kronos-render-free')
            (work/'kronos-render').mkdir()
            for file in ['publish.py','ci-publish.sh']:shutil.copy(BASE/file,work/'kronos-render'/file)
            (work/'site.txt').write_text('preserve website')
            git(work,'add','.');git(work,'commit','-m','fixture');git(work,'push','origin','HEAD')
            before=git(work,'rev-parse','HEAD')
            (runner/'kronos-validated.json').write_text(json.dumps(fixture()))
            environment={**os.environ,'RUNNER_TEMP':str(runner),'DEPLOY_BRANCH':'codex/kronos-render-free'}
            environment.pop('GITHUB_STEP_SUMMARY',None)
            result=subprocess.run(['bash','kronos-render/ci-publish.sh'],cwd=work,env=environment,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            changed=git(work,'diff','--name-only',before,'HEAD')
            self.assertEqual(changed,'kronos-render/results/forecast.json')
            self.assertEqual(git(work,'rev-parse','HEAD'),git(remote,'rev-parse','refs/heads/codex/kronos-render-free'))
            self.assertEqual((work/'site.txt').read_text(),'preserve website')
            (work/'site.txt').write_text('uncommitted work')
            result=subprocess.run(['bash','kronos-render/ci-publish.sh'],cwd=work,env=environment,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('Tracked files changed',result.stderr)
            self.assertEqual((work/'site.txt').read_text(),'uncommitted work')

if __name__=='__main__':unittest.main()
