"""Fase 3D: Latencia OLS must match classical standardized OLS inference."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

X1=[1,2,3,4,5,6,7,8,9,10,11,12]
X2=[2,1,4,3,6,5,8,7,10,9,12,11]
Y =[2.2,2.5,4.1,4.3,5.8,6.2,7.7,8.1,9.3,9.9,11.2,11.8]

def test_latencia_ols_matches_controlled_reference_and_reports_model_fit():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")

        fit=page.evaluate(
            """({x1,x2,y})=>{
              const X1=standardizedSeries(x1);
              const X2=standardizedSeries(x2);
              const Y=standardizedSeries(y);
              return olsStandardized(Y,[X1,X2]);
            }""",
            {"x1":X1,"x2":X2,"y":Y}
        )

        assert fit["df"]==9
        assert fit["dfModel"]==2
        assert fit["beta"][0]==pytest.approx(0.7342682703732745,abs=1e-10)
        assert fit["beta"][1]==pytest.approx(0.2737882584925234,abs=1e-10)
        assert fit["se"][0]==pytest.approx(0.030592888063945913,abs=1e-10)
        assert fit["se"][1]==pytest.approx(0.030592888063945913,abs=1e-10)
        assert fit["t"][0]==pytest.approx(24.001273395257456,abs=1e-8)
        assert fit["t"][1]==pytest.approx(8.949408696565206,abs=1e-8)
        assert fit["p"][0]==pytest.approx(1.808075360367557e-09,rel=2e-5)
        assert fit["p"][1]==pytest.approx(8.940791854834418e-06,rel=2e-5)
        assert fit["r2"]==pytest.approx(0.9993079767725851,abs=1e-12)
        assert fit["adjR2"]==pytest.approx(0.9991541938331595,abs=1e-12)
        assert fit["f"]==pytest.approx(6498.171907141059,rel=1e-10)
        assert fit["fP"]==pytest.approx(6.033134704430916e-15,rel=2e-4)

        page.evaluate(
            """fit=>{
              semData={names:['X1','X2','Y'],matrix:[],n:12,k:3};
              semStructuralResults={
                paths:[
                  {from:'X1',to:'Y',beta:fit.beta[0],se:fit.se[0],t:fit.t[0],p:fit.p[0],df:fit.df},
                  {from:'X2',to:'Y',beta:fit.beta[1],se:fit.se[1],t:fit.t[1],p:fit.p[1],df:fit.df}
                ],
                equations:[{
                  target:'Y',r2:fit.r2,adjR2:fit.adjR2,f:fit.f,fP:fit.fP,
                  dfModel:fit.dfModel,dfResidual:fit.df,n:fit.n
                }]
              };
            }""",
            fit
        )
        report=page.evaluate("semReportHtml()")
        assert "t de Student" in report
        assert "R² ajustado" in report
        assert "6498.17" in report
        assert "9" in report
        assert "no sustituye sem" in report.lower()

        page.evaluate("""() => {
          document.getElementById('reportStudyTitle').value='Prueba OLS';
          generateApaReport();
        }""")
        apa=page.locator("#apaReportOutput").inner_text()
        assert "Modelo estructural preliminar por OLS" in apa
        assert "R² ajustado" in apa
        assert "exploratoria" in apa.lower()
        assert not errors,repr(errors)
        browser.close()
