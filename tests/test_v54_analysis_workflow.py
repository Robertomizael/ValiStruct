from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_analysis_workflow_is_injected_and_packaged():
    main = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))
    assert 'v54-analysis-workflow.js' in main
    assert 'v54-analysis-workflow.js' in package['build']['files']


def test_cfa_professional_exposes_real_estimators_and_backend_route():
    src = (ROOT / 'desktop' / 'v54-analysis-workflow.js').read_text(encoding='utf-8')
    for estimator in ('AUTO', 'ML', 'MLR', 'GLS', 'ULS', 'DWLS', 'WLSMV', 'ULSMV'):
        assert f'value="{estimator}"' in src
    assert '/estimate' in src
    assert 'cfaSyntaxToLavaan' in src
    assert 'X-ValiStruct-Session' in src
    assert 'Estimación profesional del AFC' in src


def test_omega_is_model_based_and_does_not_restore_web_approximation():
    src = (ROOT / 'desktop' / 'v54-analysis-workflow.js').read_text(encoding='utf-8')
    assert 'omegaFromProfessionalCfa' in src
    assert "p.op === '=~'" in src
    assert "p.op === '~~'" in src
    assert 'Omega de McDonald basado en el modelo' in src
    assert 'Omega jerárquico requiere un modelo jerárquico o bifactor explícito' in src

    app = (ROOT / 'app.js').read_text(encoding='utf-8')
    assert 'function omegaApprox(M){return NaN}' in app


def test_result_catalog_collects_tables_without_deleting_original_outputs():
    src = (ROOT / 'desktop' / 'v54-analysis-workflow.js').read_text(encoding='utf-8')
    for source in (
        'aikenResults', 'cviResults', 'lawsheResults', 'delphiResults',
        'efaResults', 'cfaResults', 'cfaProfessionalResults', 'relResults',
        'modelOmegaResults', 'proResults'
    ):
        assert source in src
    assert 'Catálogo de todas las tablas generadas' in src
    assert 'Descargar selección' in src
    assert 'querySelectorAll(\'table\')' in src
