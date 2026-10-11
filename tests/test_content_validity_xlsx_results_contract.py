from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_result_exporter_is_packaged_and_injected():
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))
    assert 'content-validity-xlsx-results.js' in package['build']['files']
    patched = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    assert 'content-validity-xlsx-results.js' in patched


def test_result_exporter_covers_three_methods_without_recomputing_statistics():
    src = (ROOT / 'desktop' / 'content-validity-xlsx-results.js').read_text(encoding='utf-8')
    for token in ('cviLastResults', 'lawsheLastResults', 'delphiLastResults',
                  'downloadCviXlsxResults', 'downloadLawsheXlsxResults', 'downloadDelphiXlsxResults'):
        assert token in src
    assert 'calculateCvi' not in src
    assert 'calculateLawshe' not in src
    assert 'calculateDelphi' not in src
