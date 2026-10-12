from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_release_coherence_layer_is_packaged_and_injected():
    src = (ROOT / 'desktop' / 'v54-release-coherence.js').read_text(encoding='utf-8')
    main = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))

    assert "5.4.0-beta.1" in src
    assert "5.4 Beta" in src
    assert "v54-release-coherence.js" in main
    assert "v54-release-coherence.js" in package['build']['files']


def test_release_coherence_updates_banner_and_project_metadata_without_changing_schema():
    src = (ROOT / 'desktop' / 'v54-release-coherence.js').read_text(encoding='utf-8')
    assert "ValiStruct v5.4" in src
    assert "window.projectState" in src
    assert "appVersion: VERSION" in src
    assert "state.version" not in src
    assert "state.schemaVersion" not in src
