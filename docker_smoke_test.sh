#!/usr/bin/env bash
set -euo pipefail

BASE="${VALISTRUCT_BASE_URL:-http://127.0.0.1:8765}"

echo "[1/4] health"
curl -fsS "$BASE/health" >/dev/null

echo "[2/4] version"
curl -fsS "$BASE/version" >/dev/null

echo "[3/4] rc-check"
curl -fsS "$BASE/rc-check" >/dev/null

echo "[4/4] security-status"
curl -fsS "$BASE/security-status" >/dev/null

echo "PASS: Docker smoke test"
