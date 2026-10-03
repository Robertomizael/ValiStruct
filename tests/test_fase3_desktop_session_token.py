"""Fase 3D: renderer scientific fetch must attach Electron session token."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def test_desktop_token_bridge_and_scientific_fetch_wiring():
    main=(ROOT/"desktop/main.js").read_text(encoding="utf-8")
    preload=(ROOT/"desktop/preload.js").read_text(encoding="utf-8")
    app=(ROOT/"app.js").read_text(encoding="utf-8")
    efa=(ROOT/"efa-v52.js").read_text(encoding="utf-8")

    assert "crypto.randomBytes(32).toString('hex')" in main
    assert "VALISTRUCT_DESKTOP_SESSION_TOKEN: desktopSessionToken" in main
    assert "valistruct:get-session-token" in main
    assert "scientificToken: ipcRenderer.sendSync('valistruct:get-session-token')" in preload
    assert "version: '5.4.0-beta.1'" in preload

    assert "function scientificFetch(path,options={})" in app
    assert "headers['X-ValiStruct-Session']=token" in app

    for endpoint in [
        "/estimate","/advanced","/report-docx","/missingness","/article-docx",
        "/export-xlsx","/sem-montecarlo","/model-check","/xlsx-info",
        "/xlsx-to-csv","/legacy-to-csv",
    ]:
        assert f"scientificFetch('{endpoint}'" in app, endpoint

    assert "scientificFetch('/efa'" in efa
