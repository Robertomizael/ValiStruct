from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CTX = (ROOT / 'desktop' / 'v54-context-menu.js').read_text(encoding='utf-8')
MAIN = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
PKG = (ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8')


def test_context_menu_layer_is_injected_and_packaged():
    assert 'v54-context-menu.js' in MAIN
    assert 'v54-context-menu.js' in PKG


def test_context_menu_handles_global_right_click():
    assert "addEventListener('contextmenu'" in CTX
    assert 'Seleccionar todo' in CTX
    assert 'Copiar' in CTX
    assert 'Pegar' in CTX


def test_latencia_context_menu_has_model_actions():
    assert '#latenciaCanvas .sem-node' in CTX
    assert 'Renombrar' in CTX
    assert 'Copiar nombre' in CTX
    assert 'Eliminar' in CTX
    assert "document.getElementById('renameNode')" in CTX
    assert "document.getElementById('deleteSelected')" in CTX
