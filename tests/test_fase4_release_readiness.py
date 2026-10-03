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
