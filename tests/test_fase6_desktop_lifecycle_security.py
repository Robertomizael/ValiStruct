"""Fase 6B: desktop backend lifecycle and navigation security regression."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def test_desktop_backend_is_singleton_per_session_and_projects_use_userdata():
    main=(ROOT/"desktop/main.js").read_text(encoding="utf-8")

    assert "function backendIsRunning()" in main
    assert "if (backendIsRunning()) return backendProcess;" in main
    assert main.count("crypto.randomBytes(32).toString('hex')")==1
    assert "runtimeInfo = runtimeInfo || await ensureBundledRuntime();" in main
    assert "app.getPath('userData')" in main
    assert "VALISTRUCT_PROJECT_DIR: projectDir" in main
    assert "backendProcess = null;" in main
    assert "desktopSessionToken = null;" in main


def test_desktop_external_navigation_never_opens_with_preload():
    main=(ROOT/"desktop/main.js").read_text(encoding="utf-8")

    assert "shell } = require('electron')" in main
    assert "function installExternalNavigationGuards(win)" in main
    assert "setWindowOpenHandler" in main
    assert "return { action: 'deny' };" in main
    assert "'will-navigate'" in main
    assert "event.preventDefault();" in main
    assert "shell.openExternal(url)" in main

    install=main.index("installExternalNavigationGuards(win);")
    load=main.index("await win.loadFile(frontend);")
    assert install < load
