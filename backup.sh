#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${VALISTRUCT_BACKUP_DIR:-/app/data/backups}"
PROJECT_DIR="${VALISTRUCT_PROJECT_DIR:-/app/data/projects}"
RETENTION="${VALISTRUCT_BACKUP_RETENTION:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/valistruct_backup_${STAMP}.tar.gz"

tar -czf "$OUT" -C "$PROJECT_DIR" .

ls -1t "$BACKUP_DIR"/valistruct_backup_*.tar.gz 2>/dev/null | tail -n +$((RETENTION+1)) | xargs -r rm -f

echo "Backup creado: $OUT"
