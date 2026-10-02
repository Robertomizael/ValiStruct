"""Fase 2B: central participant data feeds Motor Pro and Latencia safely."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
CSV=("ID,i01,i02,i03,sexo\n"+
     "\n".join(
       f"P{i:03d},{1+i%5},{2+(i*2)%5},{'' if i==7 else 1+(i*3)%5},{'F' if i%2 else 'M'}"
       for i in range(1,31)
     )+"\n").encode()

def test_central_data_reuses_motorpro_and_latencia_without_false_mapping():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.on("dialog",lambda d:d.accept())
        page.goto(URL,wait_until="load")

        page.evaluate("showSection('dataimport')")
        page.locator("#unifiedDataFile").set_input_files({
            "name":"participantes_motor_latencia.csv","mimeType":"text/csv","buffer":CSV
        })
        page.wait_for_function("window.ValiStructParticipantData?.summary?.n===30")

        page.locator("#importToMotorPro").click()
        page.wait_for_function("document.getElementById('motorpro')?.classList.contains('visible')")
        assert page.evaluate("proCsvText.includes('sexo')")
        assert "participantes_motor_latencia.csv" in page.locator("#proRunStatus").inner_text()

        page.evaluate("showSection('dataimport')")
        page.locator("#participantItemNames").fill("i01, i02, i03")
        page.locator("#importToLatencia").click()
        page.wait_for_function("document.getElementById('latencia')?.classList.contains('visible')")
        assert page.evaluate("semData.n")==29
        assert page.evaluate("semData.names.join(',')")=="i01,i02,i03"
        summary=page.locator("#semDatasetSummary").inner_text()
        assert "29" in summary
        assert "1" in summary
        assert "Centro de datos" in summary

        assert page.evaluate("window.ValiStructParticipantData.summary.source")=="participantes_motor_latencia.csv"
        assert not errors,repr(errors)
        browser.close()
