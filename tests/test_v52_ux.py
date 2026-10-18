"""ValiStruct v5.2: modular navigation and honest external-validation workspaces."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
@pytest.fixture()
def page():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        errors=[]
        page.on("pageerror",lambda e: errors.append(str(e)))
        page.goto(URL,wait_until="load")
        yield page,errors
        browser.close()

def open_group(page,name):
    group=page.locator(".vs-v52-group").filter(has=page.locator("summary",has_text=name))
    if not group.evaluate("(el) => el.open"):
        group.locator("summary").click()

def test_home_is_focused_and_navigation_preserves_legacy_modules(page):
    p,errors=page
    assert p.locator(".nav-v52").count()==1
    assert p.locator(".vs-v52-dashboard").count()==1
    assert p.locator(".vs-v52-dashboard").is_visible()
    assert not p.locator("#inicio > .cards").is_visible()
    assert p.locator(".vs-v52-quick-grid > button").count()==4
    assert p.locator('.nav button[data-section="aiken"]').count()==1
    assert p.locator('.nav button[data-section="motorpro"]').count()==1
    assert p.locator('.nav button[data-section="stability"]').count()==1
    assert p.locator('.nav button[data-section="criterion"]').count()==1
    assert p.locator('.nav button[data-section="performance"]').count()==1
    assert "Autor conceptual y director científico" in p.locator(".vs-v52-sidebar-credit").inner_text()
    assert not errors,repr(errors)

def test_module_isolation_external_navigation_and_accordions(page):
    p,errors=page
    p.locator('[data-vs-target="stability"]').click()
    assert p.locator("#stability").is_visible()
    assert not p.locator("#inicio").is_visible()
    assert not p.locator("#criterion").is_visible()
    assert "Test–retest" in p.locator("#stability").inner_text()
    p.locator('.nav button[data-section="criterion"]').click()
    assert p.locator("#criterion").is_visible()
    assert not p.locator("#stability").is_visible()
    p.locator('.nav button[data-section="performance"]').click()
    assert p.locator("#performance").is_visible()
    assert not p.locator("#criterion").is_visible()
    assert "ROC" in p.locator("#performance").inner_text()
    assert not errors,repr(errors)

# v5.4 Etapa IV: performance-v54.js replaces the v5.2 placeholder form (which never
# calculated) with the real ROC/norming module. These two tests keep their original
# intent -- honest methodological framing and reuse of the shared participant base --
# against the implemented module instead of the retired placeholder.
def wait_performance_ready(page):
    page.wait_for_function("document.getElementById('performance')?.dataset.v54Performance === 'ready'")

def test_external_configuration_is_honest_and_never_calculates(page):
    p,errors=page
    open_group(p,"Validación externa")
    p.locator('.nav button[data-section="performance"]').click()
    wait_performance_ready(p)
    panel=p.locator("#performance")
    assert panel.locator(".vs-v52-config-status").count()==0
    assert "no equivalen automáticamente a puntos de corte clínicos" in panel.inner_text()
    # Without data the module must refuse to calculate, never fabricate results.
    panel.locator("#runPerformance").click()
    assert "No fue posible calcular" in panel.locator("#performanceStatus").inner_text()
    assert panel.locator("#performanceResults").inner_text().strip()==""
    assert panel.locator("#downloadPerformanceCsv").is_disabled()
    assert not errors,repr(errors)

def test_shared_data_is_preserved_from_phase_one(page):
    p,errors=page
    open_group(p,"Centro de datos")
    p.locator('.nav button[data-section="dataimport"]').click()
    p.locator("#unifiedDataFile").set_input_files({
        "name":"simulados.csv","mimeType":"text/csv",
        "buffer": b"ID,Total,Diagnostico\n1,10,1\n2,5,0\n3,7,1\n"
    })
    p.wait_for_function("window.ValiStructParticipantData?.summary?.n === 3")
    open_group(p,"Validación externa")
    p.locator('.nav button[data-section="performance"]').click()
    wait_performance_ready(p)
    panel=p.locator("#performance")
    p.wait_for_function("document.getElementById('performanceDataStatus')?.textContent.includes('3 participantes')")
    panel.locator("#performanceScore").select_option("Total")
    panel.locator("#performanceCriterion").select_option("Diagnostico")
    panel.locator("#runPerformance").click()
    assert "Análisis completado" in panel.locator("#performanceStatus").inner_text()
    # Positives (10, 7) all exceed the negative (5): AUC must be exactly 1.
    assert "1.000" in panel.locator("#performanceResults .result-card").first.inner_text()
    assert not errors,repr(errors)
