#!/usr/bin/env bash
set -euo pipefail

# RC6 bootstrap: reconstruct source, validate package identity, and materialize it.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
TMP="$(mktemp -d)"

# During the initial upload, parts 12-16 were consolidated into part_12_16.b64.
parts=(
  rc6_tar/part_00.b64 rc6_tar/part_01.b64 rc6_tar/part_02.b64 rc6_tar/part_03.b64
  rc6_tar/part_04.b64 rc6_tar/part_05.b64 rc6_tar/part_06.b64 rc6_tar/part_07.b64
  rc6_tar/part_08.b64 rc6_tar/part_09.b64 rc6_tar/part_10.b64 rc6_tar/part_11.b64
  rc6_tar/part_12_16.b64
)

for p in "${parts[@]}"; do
  [[ -f "$p" ]] || { echo "ERROR: falta $p" >&2; exit 1; }
done

cat "${parts[@]}" > "$TMP/rc6.b64"
base64 --decode "$TMP/rc6.b64" > "$TMP/rc6.tar.xz"
xz -t "$TMP/rc6.tar.xz"
mkdir -p "$TMP/extract"
tar -xJf "$TMP/rc6.tar.xz" -C "$TMP/extract"

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
