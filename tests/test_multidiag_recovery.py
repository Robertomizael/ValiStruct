"""Regression: Mahalanobis and Mardia must calculate visibly and export data."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

@pytest.fixture()
def page():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        pg=browser.new_page(viewport={"width":1440,"height":900},accept_downloads=True)
        errors=[]
        pg.on("pageerror",lambda e:errors.append(str(e)))
        pg.goto(URL,wait_until="load")
        pg.locator('.nav button[data-section="multidiag"]').click()
        yield pg,errors
        browser.close()

def test_diagnostics_button_example_and_csv_download(page):
    pg,errors=page
    pg.locator("#loadMultiExample").click()
    assert pg.locator("#runMultiDiagnostics").is_enabled()
    pg.locator("#runMultiDiagnostics").click(timeout=15000)
    pg.wait_for_function("document.querySelector('#multiRunStatus')?.textContent.includes('Cálculo completado')",timeout=25000)
    assert pg.locator("#multiResults").is_visible()
    result=pg.evaluate("""() => ({
        n:multiLast.n,k:multiLast.k,threshold:multiLast.cutoff,
        outliers:multiLast.outIdx.length,averageD2:multiLast.md.reduce((a,b)=>a+b,0)/multiLast.n,
        mardia:multiLast.mardia.kurtosis, z:multiLast.mardia.zK
    })""")
    assert result["n"]==180 and result["k"]==6
    assert result["threshold"]>0 and result["outliers"]>=1
    assert abs(result["averageD2"]-(result["k"]*(result["n"]-1)/result["n"]))<0.00001
    assert isinstance(result["mardia"],float) and isinstance(result["z"],float)
    with pg.expect_download() as result_csv:
        pg.locator("#downloadMultiResults").click()
    assert result_csv.value.suggested_filename.endswith(".csv")
    with pg.expect_download() as report:
        pg.locator("#downloadMultiReport").click()
    assert report.value.suggested_filename.endswith(".html")
    assert not errors,repr(errors)

def test_350_people_28_items_and_missing_case_exclusions(page):
    pg,errors=page
    pg.evaluate("""() => {
      let seed=20260927;
      function random(){seed=(1664525*seed+1013904223)>>>0;return (seed+.5)/4294967296}
      function gauss(){return Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random())}
      const names=Array.from({length:28},(_,j)=>'i'+String(j+1).padStart(2,'0'));
      const matrix=Array.from({length:350},()=>{
        const f1=gauss(),f2=gauss();
        return names.map((_,j)=>.2*gauss()+.25*(j<14?f1:f2)+gauss());
      });
      matrix[12][17]=null;
      multiData={names,matrix,n:350,k:28};
      multiLast=null;
    }""")
    pg.locator("#mahalPercentile").select_option("0.99")
    pg.locator("#runMultiDiagnostics").click(timeout=15000)
    pg.wait_for_function("document.querySelector('#multiRunStatus')?.textContent.includes('Cálculo completado')",timeout=55000)
    result=pg.evaluate("""() => ({
        n:multiLast.n,excluded:multiLast.nExcluded,k:multiLast.k,
        finite:multiLast.md.every(Number.isFinite),
        mardia:multiLast.mardia
    })""")
    assert result["n"]==349 and result["excluded"]==1 and result["k"]==28
    assert result["finite"]
    assert result["mardia"]["skewness"]>=0
    assert isinstance(result["mardia"]["zK"],float)
    assert not errors,repr(errors)

def test_missing_input_and_singular_covariance_have_visible_errors(page):
    pg,errors=page
    pg.locator("#runMultiDiagnostics").click()
    assert "Importe o cargue" in pg.locator("#multiRunStatus").inner_text()
    pg.evaluate("""() => {
      multiData={names:['a','b','c'],matrix:Array.from({length:40},(_,i)=>[i,i*2,i*3]),n:40,k:3};
    }""")
    pg.locator("#runMultiDiagnostics").click()
    assert "singular" in pg.locator("#multiRunStatus").inner_text().lower()
    assert pg.locator("#runMultiDiagnostics").is_enabled()
    assert not errors,repr(errors)
