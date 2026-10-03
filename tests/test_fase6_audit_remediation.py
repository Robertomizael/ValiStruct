"""Fase 6: independent-audit remediation gates."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def test_audit_remediation_wiring_and_metadata():
    app=(ROOT/"app.js").read_text(encoding="utf-8")
    backend=(ROOT/"backend/api.py").read_text(encoding="utf-8")
    desktop=(ROOT/"desktop/main.js").read_text(encoding="utf-8")
    efa=(ROOT/"efa-v52.js").read_text(encoding="utf-8")
    ci=(ROOT/".github/workflows/valistruct-ci.yml").read_text(encoding="utf-8")
    desktop_ci=(ROOT/".github/workflows/desktop-build.yml").read_text(encoding="utf-8")
    rc=(ROOT/".github/workflows/rc6-validation.yml").read_text(encoding="utf-8")

    # Blocking finding: EFA must use the same protected scientific fetch path.
    assert "scientificFetch('/efa'" in efa

    # Desktop lifecycle/security: one backend per app session, user-writable project dir,
    # external navigation kept out of the renderer/preload context.
    assert "if (backendProcess && backendProcess.exitCode === null && !backendProcess.killed) return backendProcess;" in desktop
    assert "VALISTRUCT_PROJECT_DIR: path.join(app.getPath('userData'), 'projects')" in desktop
    assert "setWindowOpenHandler" in desktop
    assert "will-navigate" in desktop
    assert "shell.openExternal(url)" in desktop

    # Active metadata must be v5.4 beta, not v5.3 / RC6.
    assert "version: '5.4.0-beta.1'" in app
    assert "displayVersion: '5.4 Beta'" in app
    assert "5.3.0-beta.1" not in app
    assert "3.0.0-rc.6" not in app
    assert '"version": "5.4.0-beta.1"' in backend
    assert '"release_channel": "beta"' in backend
    assert '"release":"5.4.0-beta.1"' in backend

    # Legacy scientific results must not silently reactivate under a new version.
    assert "legacyScientificResults=sourceAppVersion!==VALISTRUCT_RELEASE.version" in app
    assert "semStructuralResults=legacyScientificResults?null:" in app
    assert "lastResults=[];" in app
    assert "Recalcule V de Aiken y/o Latencia" in app

    # Delphi configuration lock applies at evaluation time too.
    evaluate=app[app.index("function evaluateDelphi()"):app.index("function renderDelphiResults")]
    assert "window.delphiLockedConfig && current!==window.delphiLockedConfig" in evaluate
    assert "return false;" in evaluate

    # Latencia report must tolerate old/missing inferential fields.
    report=app[app.index("function semReportHtml()"):app.index("function downloadSemReport")]
    assert "Number.isFinite(p.df)" in report
    assert "Number.isFinite(e.dfResidual)" in report
    assert "Number.isFinite(e.fP)" in report

    # Corrective branches must actually execute their gates and current report artifact.
    assert '"fix/**"' in ci
    assert "fix/v5-4-fase6-audit-remediation" in desktop_ci
    assert "Smoke packaged Windows app" in desktop_ci
    assert "Smoke packaged macOS app" in desktop_ci
    assert "http://127.0.0.1:8765/version" in desktop_ci
    assert "tests/BETA_VALIDATION_REPORT.json" in rc
    assert "tests/RC6_VALIDATION_REPORT.json" not in rc
