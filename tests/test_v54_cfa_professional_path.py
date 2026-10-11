from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_professional_path_is_injected_and_packaged():
    main = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))
    assert 'v54-cfa-professional-path.js' in main
    assert 'v54-cfa-professional-path.js' in package['build']['files']


def test_path_uses_lavaan_standardized_loadings_and_exports_images():
    src = (ROOT / 'desktop' / 'v54-cfa-professional-path.js').read_text(encoding='utf-8')
    assert "p.op==='=~'" in src
    assert 'p.std_all' in src
    assert 'window.__valistructCfaProfessionalLast' in src
    assert 'Diagrama PATH · AFC profesional' in src
    assert 'vsCfaProfessionalPathSvg' in src
    assert 'ValiStruct_AFC_profesional_PATH.svg' in src
    assert 'ValiStruct_AFC_profesional_PATH.png' in src


def test_path_registers_figure_with_results_hub():
    src = (ROOT / 'desktop' / 'v54-cfa-professional-path.js').read_text(encoding='utf-8')
    hub = (ROOT / 'desktop' / 'v54-results-hub.js').read_text(encoding='utf-8')
    assert 'ValiStructResultsHubCapture' in src
    assert "document.querySelectorAll('.panel svg')" in hub
    assert "addSnapshot(el,i,'figure')" in hub
