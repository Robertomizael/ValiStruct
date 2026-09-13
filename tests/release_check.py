from pathlib import Path
import json, py_compile, sys, subprocess, shutil, re

ROOT=Path(__file__).resolve().parents[1]
errors=[]
warnings=[]

required=[
    "index.html","app.js","styles.css","version.json","README.md",
    "backend/api.py","service-worker.js","manifest.webmanifest"
]
for rel in required:
    if not (ROOT/rel).exists():
        errors.append(f"Missing: {rel}")

try:
    py_compile.compile(str(ROOT/"backend/api.py"),doraise=True)
except Exception as e:
    errors.append(f"Python syntax: {e}")

api=(ROOT/"backend/api.py").read_text(encoding="utf-8")
for import_pattern, label in [
    (r"\bimport\s+time\b","time"),
    (r"\bimport\s+secrets\b","secrets"),
    (r"\bimport\s+hashlib\b","hashlib"),
    (r"\bfrom\s+pathlib\s+import\s+Path\b","Path"),
]:
    if not re.search(import_pattern,api):
        errors.append(f"backend missing required import: {label}")

if "APP_STARTED_AT = time.time()" in api and not re.search(r"\bimport\s+time\b",api):
    errors.append("APP_STARTED_AT uses time before import")

if "CORS(app)" in api and "VALISTRUCT_ALLOWED_ORIGINS" not in api:
    warnings.append("CORS appears unrestricted with no environment restriction")

node=shutil.which("node")
if node:
    r=subprocess.run([node,"--check",str(ROOT/"app.js")],capture_output=True,text=True)
    if r.returncode:
        errors.append("JavaScript syntax: "+r.stderr.strip())
else:
    warnings.append("Node.js not available; JS syntax check skipped")


# Additional static audits
for script in ["static_backend_audit.py","static_frontend_audit.py"]:
    rr=subprocess.run([sys.executable,str(ROOT/"tests"/script)],capture_output=True,text=True)
    if rr.returncode:
        errors.append(f"{script}: {rr.stdout.strip()} {rr.stderr.strip()}")

v=json.loads((ROOT/"version.json").read_text(encoding="utf-8"))
if v.get("version")!="3.0.0-rc.6":
    errors.append("version.json mismatch")

if warnings:
    print("\n".join("WARN: "+x for x in warnings))
if errors:
    print("\n".join("FAIL: "+x for x in errors))
    sys.exit(1)
print("PASS: ValiStruct 3.0 RC6 static release checks")
