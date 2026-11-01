#!/usr/bin/env bash
# GitHub runner only. Publish one validated data file; never reset or force-push.
set -euo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${DEPLOY_BRANCH:?DEPLOY_BRANCH is required}"
if [ "$DEPLOY_BRANCH" != codex/kronos-render-free ]; then
  echo 'Unexpected Render target branch' >&2
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo 'Tracked files changed before publication; refusing to overwrite them' >&2
  exit 1
fi
# Fetch website changes made during inference before writing the result.
git fetch origin "$DEPLOY_BRANCH"
git merge --ff-only FETCH_HEAD
python kronos-render/publish.py "$RUNNER_TEMP/kronos-validated.json"
git add -- kronos-render/results/forecast.json
if ! git diff --cached --quiet; then
  git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' commit -m 'Publish Kronos sampled forecast'
  git push origin "HEAD:refs/heads/$DEPLOY_BRANCH"
fi
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  python - <<'PY'
import json, os
from pathlib import Path
m=json.loads(Path('kronos-render/results/forecast.json').read_text())['metadata']
text=f"## Forecast generated\n\n{m['symbol']} / {m['interval']}: {m['paths']} independent paths, 512 history candles, 24 future candles.\n\nGenerated UTC: {m['generated_at_utc']}\n\n[View website](https://hjs-4.onrender.com/kronos/) after the existing Render auto-deploy completes. If auto-deploy is off, use Manual Deploy on hjs-4.\n"
with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f:f.write(text)
PY
fi
