#!/usr/bin/env bash
set -euo pipefail

# Bootstrap retained only for historical transfer compatibility. RC6 source is now uploaded directly at repository root.
if [[ -f version.json ]] && python - <<'PY'
import json
v=json.load(open('version.json',encoding='utf-8'))
assert v.get('version') == '3.0.0-rc.6'
print('RC6 source already materialized:', v.get('name'), v.get('version'))
PY
then
  exit 0
fi

echo 'ERROR: RC6 source is not materialized at repository root.' >&2
exit 1
