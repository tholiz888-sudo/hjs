#!/usr/bin/env bash
set -euo pipefail
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo 'Tracked source changes found; refusing to publish validation' >&2
  exit 1
fi
git fetch origin codex/kronos-render-free
git merge --ff-only FETCH_HEAD
python kronos-render/evaluate.py
git add -- kronos-render/results/evaluations.json
if ! git diff --cached --quiet; then
  git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' commit -m 'Update Kronos prediction versus actual validation'
  git push origin HEAD:refs/heads/codex/kronos-render-free
fi
