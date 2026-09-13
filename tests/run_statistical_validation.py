from pathlib import Path
import shutil, subprocess, sys

ROOT=Path(__file__).resolve().parents[1]
rscript=shutil.which("Rscript")
if not rscript:
    print("SKIP: Rscript no disponible.")
    sys.exit(2)

cmd=[rscript,str(ROOT/"tests/statistical_validation.R")]
r=subprocess.run(cmd,capture_output=True,text=True,timeout=180)
print(r.stdout)
if r.stderr:
    print(r.stderr,file=sys.stderr)
sys.exit(r.returncode)
