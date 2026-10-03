#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_DIR="$ROOT/runtime-env"
OUT_DIR="$ROOT/desktop/runtime"
ARCHIVE="$OUT_DIR/valistruct-runtime.tar.gz"

rm -rf "$ENV_DIR"
mkdir -p "$OUT_DIR"
rm -f "$ARCHIVE"

conda install -y -n base -c conda-forge conda-pack
conda create -y -p "$ENV_DIR" -c conda-forge \
  python=3.12.14 pip \
  r-base=4.5.3 r-jsonlite=2.0.0 r-lavaan=0.7_2 r-psych=2.6.9 r-naniar=1.1.0

"$ENV_DIR/bin/python" -m pip install --upgrade pip
"$ENV_DIR/bin/python" -m pip install -r "$ROOT/backend/requirements.txt"

"$ENV_DIR/bin/python" -c "import flask, flask_cors, pandas, openpyxl, pyreadstat, docx, bs4, xlsxwriter, portalocker; print('Python runtime OK')"
"$ENV_DIR/bin/Rscript" -e "library(jsonlite); library(lavaan); library(psych); library(naniar); cat('R runtime OK\n')"
conda list -p "$ENV_DIR" --json > "$OUT_DIR/runtime-packages.json"
test -s "$OUT_DIR/runtime-packages.json"

CONDA_ROOT="${CONDA:-$(conda info --base)}"
CONDA_PACK="$CONDA_ROOT/bin/conda-pack"
if [ ! -x "$CONDA_PACK" ]; then
  CONDA_PACK="$(find "$CONDA_ROOT" -type f -name conda-pack -perm -111 | head -n 1 || true)"
fi
if [ -z "$CONDA_PACK" ] || [ ! -x "$CONDA_PACK" ]; then
  echo "conda-pack executable was not found in base environment" >&2
  exit 1
fi

"$CONDA_PACK" -p "$ENV_DIR" -o "$ARCHIVE"
test -s "$ARCHIVE"
echo "Runtime autonomous archive created: $ARCHIVE"
