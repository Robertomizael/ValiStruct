from pathlib import Path
import json, sys

ROOT=Path(__file__).resolve().parents[1]
report=ROOT/"tests/BETA_VALIDATION_REPORT.json"

if not report.exists():
    print("BLOCK: ejecute primero python tests/validate_release.py")
    sys.exit(2)

data=json.loads(report.read_text(encoding="utf-8"))
version=json.loads((ROOT/"version.json").read_text(encoding="utf-8"))
checks=data.get("checks",[])
failed=[x for x in checks if x.get("required") and x.get("status")=="fail"]
skipped=[x for x in checks if x.get("required") and x.get("status")=="skip"]

print(f"ValiStruct {version.get('displayVersion', version.get('version', 'Beta'))} — Beta gate")
for x in checks:
    print(f"{x['status'].upper():5} {x['name']}")

if data.get("release") != version.get("version"):
    print(f"BLOCK: reporte para {data.get('release')} no coincide con versión actual {version.get('version')}.")
    sys.exit(2)
if failed:
    print(f"BLOCK: {len(failed)} prueba(s) obligatoria(s) fallaron.")
    sys.exit(1)
if skipped:
    print(f"BLOCK: {len(skipped)} prueba(s) obligatoria(s) aún no se ejecutaron.")
    sys.exit(2)

print("PASS: todos los controles obligatorios fueron ejecutados y aprobados.")
sys.exit(0)
