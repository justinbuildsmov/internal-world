#!/bin/zsh
# batch.sh <backend> <model>... : full 2° run + render for each model in turn
cd "$(dirname "$0")" || exit 1
b=$1; shift
for m in "$@"; do
  .venv/bin/python elevation.py run --backend $b --model $m --step 2 --workers ${W:-8}
  .venv/bin/python elevation.py render --backend $b --model $m --step 2
done
