from pathlib import Path
import re, json

ROOT=Path(__file__).resolve().parents[1]

def test_lavaan_engine_has_convergence_and_robust_fit():
    s=(ROOT/"backend/lavaan_engine.R").read_text(encoding="utf-8")
    assert 'lavInspect(fit, "converged")' in s
    assert "warnings_text" in s
    assert "cfi.robust" in s
    assert "rmsea.robust" in s

def test_omega_web_not_reported():
    s=(ROOT/"app.js").read_text(encoding="utf-8")
    assert "<span>Omega*</span>" not in s
    assert "Omega de McDonald:" in s

def test_service_worker_does_not_cache_dynamic_api():
    s=(ROOT/"service-worker.js").read_text(encoding="utf-8")
    assert "Dynamic/API requests are network-only" in s

def test_gunicorn_deployment():
    s=(ROOT/"deployment/Dockerfile").read_text(encoding="utf-8")
    assert "gunicorn" in s
