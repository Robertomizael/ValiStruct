#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_DIR="$ROOT/runtime-env"
OUT_DIR="$ROOT/desktop/runtime"
conda install -y -n base -c conda-forge conda-pack
conda create -y -p "$ENV_DIR" -c conda-forge python=3.12 pip r-base r-jsonlite r-lavaan r-psych r-naniar
"$ENV_DIR/bin/python" -m pip install --upgrade pip
"$ENV_DIR/bin/python" -m pip install -r "$ROOT/backend/requirements.txt"
"$ENV_DIR/bin/python" -c "import flask, flask_cors, pandas, openpyxl, pyreadstat; print('Python runtime OK')"
"$ENV_DIR/bin/Rscript" -e "library(jsonlite); library(lavaan); library(psych); library(naniar); cat('R runtime OK\n')"
mkdir -p "$OUT_DIR"
conda pack -p "$ENV_DIR" -o "$OUT_DIR/valistruct-runtime.tar.gz"
