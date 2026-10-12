from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_macos_lifecycle_guard_is_packaged_and_loaded():
    src = (ROOT / 'desktop' / 'v54-macos-window-lifecycle.js').read_text(encoding='utf-8')
    main = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))

    assert "process.platform === 'darwin'" in src
    assert "event.preventDefault()" in src
    assert "win.hide()" in src
    assert "app.on('activate'" in src
    assert "win.show()" in src
    assert "app.on('before-quit'" in src
    assert "v54-macos-window-lifecycle.js" in main
    assert "v54-macos-window-lifecycle.js" in package['build']['files']


def test_macos_lifecycle_does_not_create_a_second_backend_or_window():
    src = (ROOT / 'desktop' / 'v54-macos-window-lifecycle.js').read_text(encoding='utf-8')
    assert 'startBackend' not in src
    assert 'new BrowserWindow' not in src
    assert 'BrowserWindow.getAllWindows()' in src
