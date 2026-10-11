from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_results_hub_is_injected_and_packaged():
    main = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))
    assert 'v54-results-hub.js' in main
    assert 'v54-results-hub.js' in package['build']['files']


def test_results_hub_collects_tables_and_figures_dynamically():
    src = (ROOT / 'desktop' / 'v54-results-hub.js').read_text(encoding='utf-8')
    assert "document.querySelectorAll('.panel table')" in src
    assert "document.querySelectorAll('.panel svg')" in src
    assert 'MutationObserver' in src
    assert 'Centro integral de tablas y figuras' in src
    assert 'Descargar selección' in src
    assert 'Solo tablas' in src
    assert 'Solo figuras' in src


def test_results_hub_does_not_capture_data_preview_tables_without_result_host():
    src = (ROOT / 'desktop' / 'v54-results-hub.js').read_text(encoding='utf-8')
    assert "id.includes('result')" in src
    assert "id.includes('output')" in src
    assert "id.includes('dashboard')" in src
    assert "id.includes('report')" in src
