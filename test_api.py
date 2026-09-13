import os, json, hashlib, tempfile
import pytest

os.environ.setdefault("VALISTRUCT_AUTH_ENABLED","false")
os.environ.setdefault("VALISTRUCT_PROJECT_LIBRARY_ENABLED","false")

import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import api

@pytest.fixture
def client():
    api.app.config["TESTING"] = True
    return api.app.test_client()

def test_health(client):
    r = client.get("/health")
    assert r.status_code in (200,503)

def test_auth_status_when_disabled(client):
    r = client.get("/auth/status")
    assert r.status_code == 200
    data = r.get_json()
    assert data["authenticated"] is True

def test_projects_disabled(client):
    r = client.get("/projects")
    assert r.status_code == 403

def test_self_test(client):
    r = client.get("/self-test")
    assert r.status_code == 200
    data = r.get_json()
    assert data["ok"] is True
    assert isinstance(data["tests"], list)
