#!/usr/bin/env bash
# Run locally or in a cloud machine with model/data access. Never run on Render Free.
set -euo pipefail
cd "$(dirname "$0")"
app_root="$(pwd)"
local_root="$app_root/../.local/kronos"
mkdir -p "$local_root"
export KRONOS_REPO="${KRONOS_REPO:-$local_root/Kronos}"
export HF_HOME="${HF_HOME:-$local_root/cache}"
export MPLCONFIGDIR="${MPLCONFIGDIR:-$local_root/matplotlib}"
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-$local_root/pip-cache}"
if [ ! -e "$KRONOS_REPO" ]; then
  git clone https://github.com/shiyu-coder/Kronos.git "$KRONOS_REPO"
  git -C "$KRONOS_REPO" checkout --detach 67b630e67f6a18c9e9be918d9b4337c960db1e9a
fi
actual_revision="$(git -C "$KRONOS_REPO" rev-parse HEAD)"
if [ "$actual_revision" != 67b630e67f6a18c9e9be918d9b4337c960db1e9a ]; then
  echo 'Kronos checkout revision differs; use the pinned revision in a separate local checkout.' >&2
  exit 1
fi
export KRONOS_PYTHON="${KRONOS_PYTHON:-$local_root/venv/bin/python}"
if [ ! -x "$KRONOS_PYTHON" ]; then
  python3 -m venv "$local_root/venv"
fi
"$KRONOS_PYTHON" -m pip install 'torch==2.15.0+cpu' --index-url https://download.pytorch.org/whl/cpu
"$KRONOS_PYTHON" -m pip install -r requirements.txt
"$KRONOS_PYTHON" -m pip check
output_dir="$(mktemp -d "$local_root/run-XXXXXX")"
trap 'rm -rf "$output_dir"' EXIT
"$KRONOS_PYTHON" forecast.py --symbol BTCUSDT --interval 1h --paths 5 "$@" --output "$output_dir"
"$KRONOS_PYTHON" publish.py "$output_dir/forecast.json"
echo 'Real output is ready at kronos-render/results/forecast.json; commit this file and deploy the existing website.'
