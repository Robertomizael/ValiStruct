from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_desktop_session_auth_layer_is_packaged_and_injected():
    src = (ROOT / 'desktop' / 'v54-desktop-session-auth.js').read_text(encoding='utf-8')
    main = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))

    assert "http://127.0.0.1:8765" in src
    assert "X-ValiStruct-Session" in src
    assert "window.valistructDesktop?.scientificToken" in src
    assert "v54-desktop-session-auth.js" in main
    assert "v54-desktop-session-auth.js" in package['build']['files']


def test_auth_layer_wraps_fetch_without_changing_non_backend_requests():
    src = (ROOT / 'desktop' / 'v54-desktop-session-auth.js').read_text(encoding='utf-8')
    assert "const nativeFetch = window.fetch.bind(window)" in src
    assert "url.origin !== backendOrigin" in src
    assert "return nativeFetch(input, init)" in src
