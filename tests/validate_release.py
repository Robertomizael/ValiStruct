from pathlib import Path
import subprocess, shutil, json, sys, os, time

ROOT=Path(__file__).resolve().parents[1]
results={"release":"3.0.0-rc.6","started_at":time.time(),"checks":[]}

def run(name,cmd,cwd=None,timeout=180,required=True):
    try:
        p=subprocess.run(cmd,cwd=cwd or ROOT,capture_output=True,text=True,timeout=timeout)
        status="pass" if p.returncode==0 else "fail"
        results["checks"].append({
            "name":name,"status":status,"required":required,"code":p.returncode,
            "stdout":p.stdout[-6000:],"stderr":p.stderr[-3000:]
        })
        return p.returncode==0
    except FileNotFoundError:
        results["checks"].append({"name":name,"status":"skip","required":required,"reason":"command unavailable"})
        return not required
    except subprocess.TimeoutExpired:
        results["checks"].append({"name":name,"status":"fail","required":required,"reason":"timeout"})
        return False

run("static-release",["python",str(ROOT/"tests/release_check.py")])
run("backend-syntax",["python","-m","py_compile",str(ROOT/"backend/api.py")])
if shutil.which("node"):
    run("frontend-syntax",["node","--check",str(ROOT/"app.js")])
else:
    results["checks"].append({"name":"frontend-syntax","status":"skip","required":True,"reason":"node unavailable"})

if shutil.which("Rscript"):
    run("statistical-validation",["python",str(ROOT/"tests/run_statistical_validation.py")],timeout=300)
else:
    results["checks"].append({"name":"statistical-validation","status":"skip","required":True,"reason":"Rscript unavailable"})

# Backend pytest only when Flask is importable.
try:
    import flask, flask_cors
    run("backend-pytest",["pytest","-q","backend/tests"],timeout=240)
except Exception:
    results["checks"].append({"name":"backend-pytest","status":"skip","required":True,"reason":"Flask/flask-cors unavailable"})

# E2E only if explicitly requested and browser/runtime prepared.
if os.environ.get("VALISTRUCT_RUN_E2E","0")=="1":
    run("playwright-e2e",["pytest","-q","tests/test_e2e_playwright.py"],timeout=240)
else:
    results["checks"].append({"name":"playwright-e2e","status":"skip","required":False,"reason":"set VALISTRUCT_RUN_E2E=1"})

required_fail=[x for x in results["checks"] if x.get("required") and x["status"]=="fail"]
required_skip=[x for x in results["checks"] if x.get("required") and x["status"]=="skip"]
results["required_failures"]=len(required_fail)
results["required_skips"]=len(required_skip)
results["ready_for_beta_gate"]=not required_fail and not required_skip
results["finished_at"]=time.time()

out=ROOT/"tests/RC6_VALIDATION_REPORT.json"
out.write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding="utf-8")
print(json.dumps(results,indent=2,ensure_ascii=False))
sys.exit(0 if not required_fail else 1)
