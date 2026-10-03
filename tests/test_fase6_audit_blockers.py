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
