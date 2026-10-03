import os

os.environ.setdefault("VALISTRUCT_AUTH_ENABLED","false")
os.environ.setdefault("VALISTRUCT_INSTITUTIONAL_MODE","false")
os.environ.setdefault("VALISTRUCT_PROJECT_LIBRARY_ENABLED","false")

import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import api


def test_desktop_scientific_token_gate(monkeypatch):
    api.app.config["TESTING"]=True
    client=api.app.test_client()

    monkeypatch.setenv("VALISTRUCT_DESKTOP_SESSION_TOKEN","session-secret")

    protected=sorted(api.SCIENTIFIC_ROUTE_WHITELIST-api.DESKTOP_TOKEN_EXEMPT)
    assert "/efa" in protected

    for path in protected:
        no_token=client.post(path)
        assert no_token.status_code==401, path
        assert no_token.get_json()["error"]=="Sesión desktop no autorizada"

        wrong=client.post(path,headers={"X-ValiStruct-Session":"wrong"})
        assert wrong.status_code==401, path

        # Correct token passes the session gate and reaches endpoint validation.
        ok=client.post(path,headers={"X-ValiStruct-Session":"session-secret"})
        assert ok.status_code!=401, path

    # Preflight must remain available for CORS negotiation.
    preflight=client.options(
        "/xlsx-info",
        headers={
            "Origin":"file://",
            "Access-Control-Request-Method":"POST",
            "Access-Control-Request-Headers":"x-valistruct-session",
        },
    )
    assert preflight.status_code<400

    # Health/version remain available for startup probes.
    health=client.get("/health")
    assert health.status_code!=401

    monkeypatch.delenv("VALISTRUCT_DESKTOP_SESSION_TOKEN",raising=False)
    dev=client.post("/xlsx-info")
    assert dev.status_code!=401
