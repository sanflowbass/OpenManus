#!/usr/bin/env bash
set -euo pipefail
source .venv/bin/activate
python main.py browse --url "$1" --har-path "$2"