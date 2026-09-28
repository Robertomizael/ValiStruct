"""AFE v5.2 R validation: real extraction / numerical diagnostics.
Requires Rscript with packages psych and jsonlite.
"""
from pathlib import Path
import csv
import json
import math
import random
import shutil
import subprocess
import tempfile
import pytest

ROOT=Path(__file__).resolve().parents[1]
ENGINE=ROOT/"backend"/"efa_engine.R"
pytestmark=pytest.mark.skipif(not shutil.which("Rscript"),reason="Rscript no disponible")

def simulated_csv():
    rng=random.Random(20260927)
    rows=[["ID"]+[f"i{n}" for n in range(1,7)]]
    for index in range(220):
        a=rng.gauss(0,1); b=rng.gauss(0,1)
        row=[a*(.66+.07*j)+rng.gauss(0,.50) for j in range(3)]
        row += [b*(.67+.06*j)+rng.gauss(0,.50) for j in range(3)]
        rows.append([f"P{index+1:03d}"]+[round(v,6) for v in row])
    out=tempfile.SpooledTemporaryFile(mode="w+",newline="")
    csv.writer(out).writerows(rows)
    out.seek(0)
    return out.read()

def engine(method,rotation="oblimin"):
    payload={"csv_text":simulated_csv(),"method":method,"factors":2,
        "rotation":rotation,"parallel_runs":20,
        "item_names":[f"i{n}" for n in range(1,7)]}
    with tempfile.TemporaryDirectory() as td:
        path=Path(td);(path/"in.json").write_text(json.dumps(payload),encoding="utf8")
        proc=subprocess.run(["Rscript",str(ENGINE),str(path/"in.json"),str(path/"out.json")],
            capture_output=True,text=True,timeout=240)
        assert proc.returncode==0,proc.stderr
        result=json.loads((path/"out.json").read_text(encoding="utf8"))
        assert result.get("ok"),result
        return result

def test_diagnostics_kmo_bartlett_mardia():
    d=engine("diagnostics")
    assert d["n_complete"]==220
    assert 0 < d["kmo"]["overall"] < 1
    assert d["bartlett"]["df"]==15
    assert d["bartlett"]["p"] < .05
    assert d["mardia"]["ok"]
    assert math.isfinite(d["mardia"]["skewness"]["statistic"])
    assert math.isfinite(d["mardia"]["kurtosis"]["z"])

@pytest.mark.parametrize("method",["pa","uls","ml","gls","alpha"])
def test_real_common_factor_methods(method):
    d=engine(method)
    assert d["engine"]=="R psych"
    assert d["method"]==method
    assert d["factors"]==2
    assert len(d["loadings"])==6
    assert len(d["loadings"][0])==2
    assert len(d["communality" if "communality" in d else "communalities"])==6
    assert len(d["kmo"]["per_item"])==6
    assert d["parallel_recommended"] is not None
    assert d["parallel_runs"]==20
