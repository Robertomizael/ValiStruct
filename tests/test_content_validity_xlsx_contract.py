from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_expert_xlsx_renderer_is_packaged_and_injected():
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))
    files = package['build']['files']
    assert 'content-validity-xlsx-renderer.js' in files
    main_patched = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    assert 'content-validity-xlsx-renderer.js' in main_patched


def test_three_content_validity_methods_have_real_xlsx_roundtrip_contract():
    src = (ROOT / 'desktop' / 'content-validity-xlsx-renderer.js').read_text(encoding='utf-8')
    for token in (
        'downloadCvi', 'importCvi',
        'downloadLawshe', 'importLawshe',
        'downloadDelphi', 'importDelphi',
        'Subir XLSX completado', 'Descargar plantilla XLSX',
        "'xlsx'", 'parseSpreadsheet', 'createSpreadsheet'
    ):
        assert token in src


def test_existing_scientific_engines_are_not_replaced_by_xlsx_layer():
    app = (ROOT / 'app.js').read_text(encoding='utf-8')
    renderer = (ROOT / 'desktop' / 'content-validity-xlsx-renderer.js').read_text(encoding='utf-8')
    assert 'function calculateCvi()' in app
    assert 'const cvr=(ne-c.judges/2)/(c.judges/2);' in app
    assert 'function calculateDelphi()' in app
    assert 'function calculateCvi()' not in renderer
    assert 'function calculateLawshe()' not in renderer
    assert 'function calculateDelphi()' not in renderer


def test_xlsx_import_validates_expected_response_domains():
    src = (ROOT / 'desktop' / 'content-validity-xlsx-renderer.js').read_text(encoding='utf-8')
    assert 'validateNumericRatings' in src
    assert 'Esencial, Útil pero no esencial o No necesario' in src
    assert 'No cambie los encabezados de la plantilla' in src
