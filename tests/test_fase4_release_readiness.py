"""Fase 4: release-readiness metadata and beta gate must target the current v5.4 beta."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]


def test_v54_release_readiness_metadata_is_coherent():
    version=json.loads((ROOT/"version.json").read_text(encoding="utf-8"))
    readme=(ROOT/"README.md").read_text(encoding="utf-8")
    validator=(ROOT/"tests/validate_release.py").read_text(encoding="utf-8")
    gate=(ROOT/"tests/beta_gate.py").read_text(encoding="utf-8")
    desktop=(ROOT/".github/workflows/desktop-build.yml").read_text(encoding="utf-8")
    desktop_pkg=json.loads((ROOT/"desktop/package.json").read_text(encoding="utf-8"))
    rc_workflow=(ROOT/".github/workflows/rc6-validation.yml").read_text(encoding="utf-8")
    index=(ROOT/"index.html").read_text(encoding="utf-8")
    app=(ROOT/"app.js").read_text(encoding="utf-8")
    sw=(ROOT/"service-worker.js").read_text(encoding="utf-8")

    assert version["version"]=="5.4.0-beta.1"
    assert version["displayVersion"]=="5.4 Beta"
    assert version["projectFormat"]=="3.0"
    assert version["releaseChannel"]=="beta"
    assert version["featureFreeze"] is True
    assert "v5.4 beta release readiness" in version["focus"]

    assert "ValiStruct v5.4 Beta" in readme
    assert "ValiStruct v3.0.1 Beta" not in readme

    assert 'VERSION=json.loads((ROOT/"version.json")' in validator
    assert 'BETA_VALIDATION_REPORT.json' in validator
    assert '"3.0.0-rc.6"' not in validator

    assert 'BETA_VALIDATION_REPORT.json' in gate
    assert 'data.get("release") != version.get("version")' in gate
    assert "ValiStruct 3.0 RC6" not in gate

    assert "feature/v5-4-fase4-release-readiness" in desktop
    assert desktop_pkg["dependencies"]["tar"]=="7.4.3"
    assert desktop_pkg["dependencies"]["xlsx"]=="0.18.5"
    assert desktop_pkg["devDependencies"]["electron"]=="32.1.2"
    assert desktop_pkg["devDependencies"]["electron-builder"]=="25.1.8"
    assert "Current beta release gate" in rc_workflow
    assert "python tests/validate_release.py" in rc_workflow
    assert "python tests/beta_gate.py" in rc_workflow

    assert "ValiStruct v5.4 Beta" in index
    assert "ValiStruct v5.3" not in index
    assert "version:'5.4.0-beta.1'" in app
    assert "version:'5.3.0-beta.1'" not in app
    assert "valistruct-v5-4-0-beta1-fase4-20261003" in sw
