import os
import sys
from pathlib import Path
import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import api

SCIENTIFIC_POSTS=[
    "/efa","/estimate","/advanced","/report-docx","/missingness",
    "/article-docx","/export-xlsx","/sem-montecarlo","/model-check",
    "/xlsx-info","/xlsx-to-csv","/legacy-to-csv",
]

@pytest.fixture
def client():
    api.app.config["TESTING"]=True
    return api.app.test_client()

def test_scientific_mode_hides_institutional_routes(monkeypatch,client):
    monkeypatch.setenv("VALISTRUCT_INSTITUTIONAL_MODE","false")
    for path in ["/auth/status","/projects","/admin/backup","/notifications",
                 "/telemetry","/incidents","/monitor","/self-test",
                 "/rc-check","/security-status","/runtime-audit"]:
        response=client.get(path)
        assert response.status_code==404,(path,response.status_code,response.get_data(as_text=True))
    assert client.get("/health").status_code in (200,503)
    assert client.get("/version").status_code!=404
    for path in SCIENTIFIC_POSTS:
        response=client.post(path,json={})
        assert response.status_code!=404,(path,response.status_code)

def test_institutional_mode_restores_existing_routes(monkeypatch,client):
    monkeypatch.setenv("VALISTRUCT_INSTITUTIONAL_MODE","true")
    # Existing auth-disabled semantics are preserved when institutional mode is explicit.
    assert client.get("/auth/status").status_code==200
    assert client.get("/self-test").status_code==200
    assert client.get("/admin/backup").status_code!=404

def test_unknown_route_is_never_accidentally_whitelisted(monkeypatch,client):
    monkeypatch.setenv("VALISTRUCT_INSTITUTIONAL_MODE","false")
    assert client.get("/future-admin-capability").status_code==404
