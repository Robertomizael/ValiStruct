"""ValiStruct v5.3 Fase 1: reversible scientific navigation simplification."""
import os,re
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
VISIBLE={
    "inicio","dataimport","diagnostics","multidiag","missingpro",
    "aiken","efa","cfa","reliability","stability","criterion","performance",
    "motorpro","resultcenter","projects","methodguide","privacy","acerca"
}
INTEGRATED={
    "legacyimport":"dataimport",
    "advanced":"motorpro","latencia":"motorpro","syntaxpro":"motorpro",
    "templates":"motorpro","modelcheck":"motorpro","modelcompare":"motorpro",
    "estimadorguide":"motorpro","samplesize":"motorpro","semmontecarlo":"motorpro",
    "reportapa":"resultcenter","articletables":"resultcenter",
    "qualitydashboard":"resultcenter","conclusionassistant":"resultcenter",
    "finalcheck":"resultcenter","journalready":"resultcenter",
    "validacion":"inicio","assistantflow":"inicio","guidedproject":"inicio",
    "helpcenter":"methodguide","guia":"methodguide","referencias":"methodguide",
    "userdocs":"methodguide","history":"projects","migration":"projects",
    "encryption":"projects","profiles":"privacy","appsettings":"privacy",
    "accessibility":"privacy","advancedsettings":"privacy","systemcheck":"privacy",
    "updates":"privacy",
}
ADMIN={
    "auth","oidc","teams","institutionlib","sync","versions","peerreview",
    "activitylog","notifications","conflicts","tasks","collabexport","approvals",
    "auditpackage","adminpanel","servermonitor","backuprestore","scheduledbackup",
    "serverwizard","incidents","telemetry","installer"
}
QA={
    "regression","e2e","backendtests","loadtesting","a11yaudit","betaready",
    "betametrics","releasecandidate","securityreview","releases","kanban"
}

@pytest.fixture()
def page():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        pg=browser.new_page(viewport={"width":1440,"height":900})
        errors=[]
        pg.on("pageerror",lambda exc:errors.append(str(exc)))
        pg.on("dialog",lambda d:d.dismiss())
        pg.goto(URL,wait_until="load")
        yield pg,errors
        browser.close()

def open_section(pg,section):
    pg.locator(f'.nav button[data-section="{section}"]').evaluate("(el)=>el.click()")
    pg.wait_for_function(
        "(id)=>document.getElementById(id)?.classList.contains('visible')",
        arg=section,timeout=5000)

def test_single_manifest_classifies_every_navigation_button(page):
    pg,errors=page
    classified=pg.eval_on_selector_all(
        ".nav button[data-section]",
        "els=>els.map(x=>[x.dataset.section,x.dataset.vsVisibility,x.dataset.vsParent||''])"
    )
    assert len(classified)>=83
    assert len({x[0] for x in classified})==len(classified)
    mapping={x[0]:(x[1],x[2]) for x in classified}
    assert {k for k,v in mapping.items() if v[0]=="visible"}==VISIBLE
    assert {k:v[1] for k,v in mapping.items() if v[0]=="integrated"}==INTEGRATED
    assert {k for k,v in mapping.items() if v[0]=="admin"}==ADMIN
    assert {k for k,v in mapping.items() if v[0]=="qa"}==QA
    assert not errors,errors

def test_integrated_tools_remain_reachable_and_parent_is_highlighted(page):
    pg,errors=page
    for child,parent in INTEGRATED.items():
        open_section(pg,parent)
        target=pg.locator(f'#{parent} [data-vs-target="{child}"]')
        assert target.count()>=1,(parent,child)
        assert target.first.is_visible(),(parent,child)
    open_section(pg,"dataimport")
    pg.locator('#dataimport [data-vs-target="legacyimport"]').click()
    assert pg.locator("#legacyimport").is_visible()
    assert pg.locator('.nav button[data-section="dataimport"]').get_attribute("class").find("vs-v53-parent-active")>=0
    assert not errors,errors

def test_admin_is_opt_in_but_qa_never_enters_normal_navigation(page):
    pg,errors=page
    assert pg.locator(".vs-v53-admin-group").is_hidden()
    assert pg.locator(".vs-v53-qa-store").is_hidden()
    open_section(pg,"privacy")
    toggle=pg.locator("#institutionalUiToggle")
    assert toggle.count()==1
    toggle.check()
    assert pg.locator(".vs-v53-admin-group").is_visible()
    for section in ADMIN:
        assert pg.locator(f'.vs-v53-admin-group button[data-section="{section}"]').count()==1
    for section in QA:
        assert pg.locator(f'.vs-v53-qa-store button[data-section="{section}"]').count()==1
        assert pg.locator(f'.vs-v53-qa-store button[data-section="{section}"]').is_hidden()
    assert not errors,errors

def test_external_validation_is_explicitly_preparing(page):
    pg,errors=page
    home=pg.locator('[data-vs-target="stability"]')
    assert "En preparación" in home.inner_text()
    for section in ("stability","criterion","performance"):
        button=pg.locator(f'.nav button[data-section="{section}"]')
        assert "En preparación" in button.inner_text()
        open_section(pg,section)
        text=pg.locator(f"#{section}").inner_text()
        assert "En preparación" in text
        assert "Este módulo aún no realiza cálculos" in text
    assert not errors,errors

def test_old_version_badges_are_not_visible(page):
    pg,errors=page
    texts=pg.locator(".badge:visible").all_inner_texts()
    bad=[x for x in texts if re.search(r"(ValiStruct\s*\d|\bv\d|RC\d|functional\s+v|Beta\b)",x,re.I)]
    assert not bad,bad
    assert not errors,errors
