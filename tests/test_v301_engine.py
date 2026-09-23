"""Regresiones del motor v3.0.1. Ejecute con Rscript, lavaan y jsonlite."""
import csv, io, json, random, shutil, subprocess, tempfile
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[1]
RSCRIPT=shutil.which("Rscript")
pytestmark=pytest.mark.skipif(not RSCRIPT,reason="Rscript no disponible")
SYNTAX="F1 =~ x1 + x2 + x3\nF2 =~ x4 + x5 + x6\nF3 =~ x7 + x8 + x9"

def fixture_csv():
    rng=random.Random(20260922)
    buf=io.StringIO()
    cols=["id","grupo"]+[f"x{i}" for i in range(1,10)]
    writer=csv.DictWriter(buf,fieldnames=cols)
    writer.writeheader()
    for n in range(400):
        factors=[rng.gauss(0,1) for _ in range(3)]
        row={"id":n+1,"grupo":1+(n%2)}
        for i in range(9):
            z=.8*factors[i//3]+.6*rng.gauss(0,1)
            row[f"x{i+1}"]=max(1,min(5,round(z+3)))
        writer.writerow(row)
    return buf.getvalue()

def run_engine(engine,**extra):
    payload={"csv_text":fixture_csv(),"syntax":SYNTAX,"estimator":"WLSMV","data_type":"ordinal",**extra}
    with tempfile.TemporaryDirectory() as td:
        inp,out=Path(td)/"in.json",Path(td)/"out.json"
        inp.write_text(json.dumps(payload),encoding="utf-8")
        process=subprocess.run([RSCRIPT,str(ROOT/"backend"/engine),str(inp),str(out)],
            capture_output=True,text=True,timeout=300)
        assert process.returncode==0,process.stderr
        data=json.loads(out.read_text(encoding="utf-8"))
        assert data.get("ok"),data.get("error")
        return data

def test_numeric_id_and_group_not_ordinal():
    r=run_engine("lavaan_engine.R")
    assert sorted(r["ordered_vars"])==sorted(f"x{i}" for i in range(1,10))

def test_latent_correlations():
    r=run_engine("lavaan_engine.R")
    assert set(r["latent_correlations"]["names"])=={"F1","F2","F3"}

def test_esem_rotation():
    syntax='efa("b")*F1 + efa("b")*F2 + efa("b")*F3 =~ '+ " + ".join(f"x{i}" for i in range(1,10))
    r=run_engine("lavaan_engine.R",syntax=syntax,rotation="geomin")
    assert r["converged"] and r["rotation"]=="geomin"

def test_fornell_larcker_metrics():
    # El servidor R debe tener instalado el paquete psych para HTMT policórico.
    r=run_engine("advanced_engine.R",action="quality")
    for factor in r["metrics"]:
        assert {"sqrt_ave","max_latent_r","fornell_larcker_ok"} <= set(factor)

def test_ordinal_invariance_thresholds():
    r=run_engine("advanced_engine.R",action="invariance",group="grupo")
    rows={x["model"]:x for x in r["invariance"]}
    assert r["fit_type"]=="scaled"
    assert rows["scalar"]["delta_df"] is not None
    assert rows["strict"]["delta_df"] is not None
