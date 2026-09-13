#!/bin/sh
set -e
python3 -m pip install -r requirements.txt
Rscript install_R_packages.R
exec gunicorn --workers "${VALISTRUCT_GUNICORN_WORKERS:-2}" --threads "${VALISTRUCT_GUNICORN_THREADS:-4}" --timeout "${VALISTRUCT_GUNICORN_TIMEOUT:-360}" --bind "${VALISTRUCT_BIND:-127.0.0.1:8765}" api:app
