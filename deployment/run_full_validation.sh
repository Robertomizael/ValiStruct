#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== Static checks =="
python tests/release_check.py

echo "== Python preflight =="
python tests/preflight.py

echo "== Statistical validation =="
python tests/run_statistical_validation.py

echo "== Backend tests =="
pytest -q backend/tests

echo "== Beta gate =="
python tests/validate_release.py
python tests/beta_gate.py
