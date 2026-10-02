"""Golden numeric masters for Fase 0. These freeze behavior; they are not universal truths."""
from pathlib import Path
import json, os, pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
EXPECTED=json.loads((ROOT/"tests/fixtures/numeric/expected_core.json").read_text(encoding="utf-8"))

MATRIX=[
 [1,2,2,3],[2,2,3,3],[2,3,3,4],[3,3,4,4],
 [3,4,4,5],[4,4,5,5],[4,5,5,4],[5,5,4,5],
 [2,4,3,5],[5,3,5,4],[3,5,4,3],[4,2,5,2],
]

def close(a,b,tol=1e-12):
    assert abs(float(a)-float(b))<=tol,(a,b,tol)

def test_core_javascript_numeric_golden_master():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        page.goto(URL,wait_until="load")
        got=page.evaluate("""matrix => {
          const R=efaCorrelationMatrix(matrix);
          const kmo=kmoOverall(R);
          const bart=bartlettTest(R,matrix.length);
          const eig=jacobiEigen(R).values;
          const md=mahalanobisDistances(matrix);
          const mardia=mardiaStats(matrix);
          const alpha=cronAlpha(matrix);
          const ci=scoreCI(.9,5,4,.95);
          return {R,kmo,bart,eig,md,mardia,alpha,ci};
        }""",MATRIX)
        close(got["alpha"],EXPECTED["reliability"]["alpha"])
        close(got["ci"]["lower"],EXPECTED["aiken"]["ci95"]["lower"])
        close(got["ci"]["upper"],EXPECTED["aiken"]["ci95"]["upper"])
        for i,row in enumerate(EXPECTED["correlation"]):
            for j,value in enumerate(row): close(got["R"][i][j],value)
        close(got["kmo"]["overall"],EXPECTED["kmo"]["overall"])
        for a,b in zip(got["kmo"]["perItem"],EXPECTED["kmo"]["perItem"]): close(a,b)
        close(got["bart"]["det"],EXPECTED["bartlett"]["det"])
        close(got["bart"]["chi2"],EXPECTED["bartlett"]["chi2"])
        close(got["bart"]["p"],EXPECTED["bartlett"]["pApprox"],1e-10)
        for a,b in zip(got["eig"],EXPECTED["pcaEigenvalues"]): close(a,b,1e-10)
        for a,b in zip(got["md"],EXPECTED["mahalanobis"]): close(a,b,1e-10)
        for key in ["skewness","kurtosis","expectedK","zK","skewChi2","skewDf","skewP"]:
            expkey="skewPApprox" if key=="skewP" else key
            close(got["mardia"][key],EXPECTED["mardia"][expkey],1e-9)
        browser.close()

def test_aiken_fixture_documents_approved_interval_change():
    note=EXPECTED["note"].lower()
    assert "aiken" in note and "penfield" in note and "n*k" in note
