"""Fase 6A: independent-audit blockers must stay closed."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]


def test_efa_uses_desktop_scientific_fetch_and_versions_are_current():
    efa=(ROOT/"efa-v52.js").read_text(encoding="utf-8")
    app=(ROOT/"app.js").read_text(encoding="utf-8")
    backend=(ROOT/"backend/api.py").read_text(encoding="utf-8")
    version=json.loads((ROOT/"version.json").read_text(encoding="utf-8"))
    desktop=json.loads((ROOT/"desktop/package.json").read_text(encoding="utf-8"))

    assert "scientificFetch('/efa'" in efa
    assert "fetch(getProApiBase()+'/efa'" not in efa

    assert "version: '5.4.0-beta.1'" in app
    assert "displayVersion: '5.4 Beta'" in app
    assert "5.3.0-beta.1" not in app
    assert "3.0.0-rc.6" not in app
    assert "release-candidate" not in app
    assert "Canal</span><strong>RC1" not in app

    assert 'APP_VERSION = RELEASE_METADATA["version"]' in backend
    assert 'PROJECT_FORMAT = RELEASE_METADATA["projectFormat"]' in backend
    assert 'RELEASE_CHANNEL = RELEASE_METADATA["releaseChannel"]' in backend
    assert "3.0.0-rc.6" not in backend

    assert version["version"]=="5.4.0-beta.1"
    assert desktop["version"]==version["version"]
    assert any(x.get("from")=="../version.json" and x.get("to")=="version.json"
               for x in desktop["build"]["extraResources"])


def test_release_reproducibility_and_cleanup():
    pkg=json.loads((ROOT/"desktop/package.json").read_text())
    lock=json.loads((ROOT/"desktop/package-lock.json").read_text())
    runtime=json.loads((ROOT/"release/runtime-v5.4-beta1.json").read_text())
    workflow=(ROOT/".github/workflows/desktop-build.yml").read_text()
    unified=(ROOT/".github/workflows/valistruct-ci.yml").read_text()
    rc=(ROOT/".github/workflows/rc6-validation.yml").read_text()
    ci=(ROOT/".github/workflows/valistruct-ci.yml").read_text()
    req=(ROOT/"backend/requirements.txt").read_text()
    mac=(ROOT/"desktop/scripts/build_runtime_macos.sh").read_text()
    win=(ROOT/"desktop/scripts/build_runtime_windows.ps1").read_text()

    assert lock["lockfileVersion"]==3
    assert pkg["dependencies"]["tar"]=="7.5.22"
    assert pkg["dependencies"]["xlsx"]=="https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
    assert pkg["devDependencies"]["electron"]=="43.7.7"
    assert pkg["devDependencies"]["electron-builder"]=="26.15.3"
    assert pkg["overrides"]["@electron/get"]=="5.1.0"
    assert lock["packages"][""]["dependencies"]==pkg["dependencies"]
    assert workflow.count("run: npm ci")==2
    assert workflow.count('node-version: "22.12.0"')==2
    assert 'node-version: "22.12.0"' in unified
    assert "run: npm install" not in workflow
    assert workflow.count("npm audit --audit-level=high")==2
    assert "npm audit --omit=dev" not in workflow
    assert "Smoke packaged Windows app" in workflow and "Smoke packaged macOS app" in workflow
    assert "python=3.12.14" in mac and "python=3.12.14" in win
    assert "r-base=4.5.3" in mac and "r-base=4.5.3" in win
    assert "r-lavaan=0.7_2" in mac and "r-lavaan=0.7_2" in win
    assert runtime["python"]=="3.12.14" and runtime["r"]=="4.5.3"
    assert runtime["buildNode"]=="22.12.0"
    assert runtime["desktopPackages"]["electronBuilder"]=="26.15.3"
    assert runtime["desktopPackages"]["electronGet"]=="5.1.0"
    assert all("==" in x for x in req.splitlines() if x.strip())
    assert "tests/BETA_VALIDATION_REPORT.json" in rc
    assert "tests/RC6_VALIDATION_REPORT.json" not in rc
    assert '"main"' in ci
    assert "valistruct-v5-4-0-beta1-fase6-20261003" in (ROOT/"service-worker.js").read_text()
