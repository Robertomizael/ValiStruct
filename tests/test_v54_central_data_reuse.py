from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_participant_store_is_packaged_for_desktop():
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))
    resources = package['build']['extraResources']
    assert any(x.get('from') == '../participant-data.js' and x.get('to') == 'app/participant-data.js' for x in resources)


def test_participant_store_exposes_single_source_reuse_api():
    src = (ROOT / 'participant-data.js').read_text(encoding='utf-8')
    assert 'ValiStructParticipantData' in src
    assert 'setCsv(csvText' in src
    assert 'numericFrame(options = {})' in src
    assert 'numericMatrix(options = {})' in src
    assert 'toCsv()' in src
    assert "valistruct:participants-changed" in src


def test_center_data_routes_reuse_same_canonical_dataset():
    app = (ROOT / 'app.js').read_text(encoding='utf-8')
    for route in ('importToDiagnostics', 'importToReliability', 'importToEfa', 'importToCfa', 'importToMotorPro'):
        assert route in app
    assert 'useCentralDataForDiagnostics' in app
    assert 'getUnifiedParticipantMatrix()' in app
    assert 'canonicalParticipantCsv()' in app
    assert "efaData={itemNames:[...data.itemNames],matrix:data.matrix.map" in app
    assert 'cfaData=parseCfaCSV(data.csv)' in app
    assert 'proCsvText=csv' in app


def test_professional_cfa_consumes_the_reused_cfa_dataset():
    src = (ROOT / 'desktop' / 'v54-analysis-workflow.js').read_text(encoding='utf-8')
    assert "const data = getGlobal('cfaData')" in src
    assert 'dataToCsv(data)' in src
    assert "fetch(`${apiBase()}/estimate`" in src


def test_integral_results_hub_captures_tables_and_figures():
    src = (ROOT / 'desktop' / 'v54-results-hub.js').read_text(encoding='utf-8')
    assert "querySelectorAll('.panel table')" in src
    assert "querySelectorAll('.panel svg')" in src
    assert "type==='table'?'Tabla':'Figura'" in src
    assert 'Descargar selección' in src


def test_professional_path_and_diagnostic_profile_are_capturable_figures():
    path_src = (ROOT / 'desktop' / 'v54-cfa-professional-path.js').read_text(encoding='utf-8')
    diag_src = (ROOT / 'desktop' / 'v54-diagnostics-interpretation.js').read_text(encoding='utf-8')
    assert '<svg' in path_src and 'std_all' in path_src
    assert 'vsDistributionProfileSvg' in diag_src
    assert '<svg' in diag_src
