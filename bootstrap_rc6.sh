#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
TMP="$(mktemp -d)"

all_parts=(
  rc6_tar/part_00.b64 rc6_tar/part_01.b64 rc6_tar/part_02.b64 rc6_tar/part_03.b64
  rc6_tar/part_04.b64 rc6_tar/part_05.b64 rc6_tar/part_06.b64 rc6_tar/part_07.b64
  rc6_tar/part_08.b64 rc6_tar/part_09.b64 rc6_tar/part_10.b64 rc6_tar/part_11.b64
  rc6_tar/part_12.b64 rc6_tar/part_13.b64 rc6_tar/part_14.b64 rc6_tar/part_15.b64
  rc6_tar/part_12_16.b64
)

for p in "${all_parts[@]}"; do
  [[ -f "$p" ]] || { echo "ERROR: falta $p" >&2; exit 1; }
done

build_candidate() {
  local out="$1"; shift
  : > "$out"
  for p in "$@"; do
    base64 --decode --ignore-garbage "$p" >> "$out"
  done
}

# Candidato A: 00..15 + fragmento final histórico.
build_candidate "$TMP/rc6-a.tar.xz" "${all_parts[@]}"
if xz -t "$TMP/rc6-a.tar.xz" 2>/dev/null; then
  ARCHIVE="$TMP/rc6-a.tar.xz"
else
  # Candidato B: 00..11 + fragmento consolidado 12_16.
  compact=(
    rc6_tar/part_00.b64 rc6_tar/part_01.b64 rc6_tar/part_02.b64 rc6_tar/part_03.b64
    rc6_tar/part_04.b64 rc6_tar/part_05.b64 rc6_tar/part_06.b64 rc6_tar/part_07.b64
    rc6_tar/part_08.b64 rc6_tar/part_09.b64 rc6_tar/part_10.b64 rc6_tar/part_11.b64
    rc6_tar/part_12_16.b64
  )
  build_candidate "$TMP/rc6-b.tar.xz" "${compact[@]}"
  if xz -t "$TMP/rc6-b.tar.xz" 2>/dev/null; then
    ARCHIVE="$TMP/rc6-b.tar.xz"
  else
    # Candidato C: 00..15 sin fragmento adicional.
    regular=("${all_parts[@]:0:16}")
    build_candidate "$TMP/rc6-c.tar.xz" "${regular[@]}"
    if xz -t "$TMP/rc6-c.tar.xz" 2>/dev/null; then
      ARCHIVE="$TMP/rc6-c.tar.xz"
    else
      echo "ERROR: no se pudo reconstruir un archivo XZ válido con los fragmentos RC6" >&2
      exit 1
    fi
  fi
fi

mkdir -p "$TMP/extract"
tar -xJf "$ARCHIVE" -C "$TMP/extract"
VERSION_FILE="$(find "$TMP/extract" -type f -name version.json -print -quit)"
[[ -n "$VERSION_FILE" ]] || { echo "ERROR: version.json no encontrado" >&2; exit 1; }
SRC="$(dirname "$VERSION_FILE")"

python - "$VERSION_FILE" <<'PY'
import json,sys
v=json.load(open(sys.argv[1],encoding='utf-8'))
assert v.get('version') == '3.0.0-rc.6', v
print('Paquete identificado:', v.get('name'), v.get('version'))
PY

cp -a "$SRC"/. "$ROOT"/
echo "RC6 materializado correctamente en la raíz del repositorio."
