"""Fase 3B H-E: app, project metadata, PWA cache and desktop package must agree on v5.4 beta."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def test_v54_version_metadata_is_coherent():
    version=json.loads((ROOT/"version.json").read_text(encoding="utf-8"))
    desktop=json.loads((ROOT/"desktop/package.json").read_text(encoding="utf-8"))
    app=(ROOT/"app.js").read_text(encoding="utf-8")
    sw=(ROOT/"service-worker.js").read_text(encoding="utf-8")
    shell=(ROOT/"v52-shell.js").read_text(encoding="utf-8")

    assert version["version"]=="5.4.0-beta.1"
    assert version["displayVersion"]=="5.4 Beta"
    assert version["projectFormat"]=="3.0"
    assert desktop["version"]=="5.4.0-beta.1"
    assert "ValiStruct Desktop 5.4 Beta" in desktop["description"]
    assert "appVersion:'5.4.0-beta.1'" in app
    assert "projectFormat:'3.0'" in app
    assert "valistruct-v5-4-0-beta1-fase3-20261002" in sw
    assert "ValiStruct v5.4" in shell
    assert "v5-3-0-fase1-navfix" not in sw
