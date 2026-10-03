import os
import secrets

os.environ.setdefault("VALISTRUCT_AUTH_ENABLED","false")
os.environ.setdefault("VALISTRUCT_INSTITUTIONAL_MODE","false")
os.environ.setdefault("VALISTRUCT_PROJECT_LIBRARY_ENABLED","false")

import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import api


def _gate(path, token=None):
    headers={}
    if token is not None:
        headers["X-ValiStruct-Session"]=token
    with api.app.test_request_context(path,method="POST",headers=headers):
        return api._valistruct_capability_gate()


def test_every_scientific_desktop_route_is_session_protected(monkeypatch):
    secret="fase6-session-secret"
    monkeypatch.setenv("VALISTRUCT_DESKTOP_SESSION_TOKEN",secret)

    protected=sorted(api.SCIENTIFIC_ROUTE_WHITELIST-api.DESKTOP_TOKEN_EXEMPT)
    assert "/efa" in protected
    assert protected

    for path in protected:
        missing=_gate(path)
        assert missing is not None and missing[1]==401, path

        wrong=_gate(path,"wrong")
        assert wrong is not None and wrong[1]==401, path

        correct=_gate(path,secret)
        assert correct is None, path

    # Startup probes remain intentionally exempt.
    for path in sorted(api.DESKTOP_TOKEN_EXEMPT):
        assert _gate(path) is None, path
