"""Regression for Motor Pro's undefined indices, five-factor AFC and truthful UI.
Uses the real Rscript lavaan engine; all records are synthetic.
"""
import csv
import io
import json
import math
import random
import shutil
import subprocess
import tempfile
from pathlib import Path
import pytest

ENGINE=Path(__file__).resolve().parents[1]/"backend"/"lavaan_engine.R"
pytestmark=pytest.mark.skipif(not shutil.which("Rscript"),reason="Rscript required")

def synthetic_data(n=350,groups=(5,6,6,6,5)):
    rng=random.Random(20260927)
    out=io.StringIO()
    writer=csv.writer(out)
    names=[f"i{i:02d}" for i in range(1,sum(groups)+1)]
    writer.writerow(["ID"]+names)
    for row in range(n):
        common=rng.gauss(0,1)
        factors=[.42*common+rng.gauss(0,.91) for _ in groups]
        values=[]
        for j,ng in enumerate(groups):
            values.extend(round((.65+.04*(k%4))*factors[j]+rng.gauss(0,.68),6) for k in range(ng))
        writer.writerow([f"P{row+1:03d}"]+values)
    groups_syntax=[]
    start=1
    for j,count in enumerate(groups):
        groups_syntax.append("F%d =~ "%(j+1)+" + ".join(f"i{i:02d}" for i in range(start,start+count)))
        start+=count
    return out.getvalue(),"\n".join(groups_syntax),names

def run_model(csv_text,syntax,estimator="MLR"):
    with tempfile.TemporaryDirectory() as td:
        folder=Path(td)
        payload={"syntax":syntax,"csv_text":csv_text,"estimator":estimator,
            "data_type":"continuous","missing":"listwise","bootstrap":0,"rotation":"geomin"}
        (folder/"input.json").write_text(json.dumps(payload),encoding="utf-8")
        result=subprocess.run(["Rscript",str(ENGINE),str(folder/"input.json"),str(folder/"output.json")],
            capture_output=True,text=True,timeout=180)
        assert result.returncode==0,result.stderr
        answer=json.loads((folder/"output.json").read_text(encoding="utf-8"))
        assert answer.get("ok") is True,answer.get("error")
        return answer

def validate_metric_dict(obj):
    assert isinstance(obj,dict)
    for key,val in obj.items():
        assert val is None or (isinstance(val,(int,float)) and math.isfinite(val)),(key,val)

def test_real_350_by_28_five_factor_model_reports_fit():
    csv_text,syntax,_=synthetic_data()
    result=run_model(csv_text,syntax)
    assert result["n"]==350
    assert result["converged"] is True
    assert result["estimator"]=="MLR"
    for measure in ["chisq","df","pvalue","cfi","tli","rmsea","srmr"]:
        val=result["fit"][measure]
        assert val is not None and math.isfinite(val),(measure,val)
    assert result["fit"]["df"]>0
    validate_metric_dict(result["fit"])
    validate_metric_dict(result["fit_robust"])
    assert len(result["parameters"])>=28

def test_saturated_model_does_not_crash_when_robust_indices_undefined():
    csv_text,_,_=synthetic_data(n=160,groups=(3,))
    result=run_model(csv_text,"F1 =~ i01 + i02 + i03",estimator="MLR")
    assert result["converged"] is True
    assert result["fit"]["df"]==0
    validate_metric_dict(result["fit"])
    validate_metric_dict(result["fit_robust"])
    assert result["fit"].get("chisq") is not None

def test_invalid_bootstrap_returns_meaningful_error_not_r_exception():
    csv_text,syntax,_=synthetic_data(n=60,groups=(3,3))
    with tempfile.TemporaryDirectory() as td:
        root=Path(td)
        payload={"syntax":syntax,"csv_text":csv_text,"estimator":"MLR",
            "data_type":"continuous","missing":"listwise","bootstrap":"invalid"}
        (root/"i.json").write_text(json.dumps(payload),encoding="utf-8")
        proc=subprocess.run(["Rscript",str(ENGINE),str(root/"i.json"),str(root/"o.json")],
            capture_output=True,text=True,timeout=60)
        assert proc.returncode==0,proc.stderr
        output=json.loads((root/"o.json").read_text())
        assert output["ok"] is False and "bootstrap" in output["error"].lower()
