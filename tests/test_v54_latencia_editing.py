from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_latencia_editor_is_packaged_and_injected():
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))
    assert 'v54-latencia-editing.js' in package['build']['files']
    main = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    assert 'v54-latencia-editing.js' in main


def test_latencia_editor_avoids_native_prompt_and_supports_nodes():
    src = (ROOT / 'desktop' / 'v54-latencia-editing.js').read_text(encoding='utf-8')
    assert "getElementById('renameNode')" in src
    assert '.sem-node.selected' in src
    assert 'v54LatenciaEditorInput' in src
    assert 'dblclick' in src
    assert 'window.renameSelected()' in src
    assert 'window.prompt = () => clean' in src
    assert 'stopImmediatePropagation' in src
