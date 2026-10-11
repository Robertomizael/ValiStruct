from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_diagnostics_interpretation_is_injected_and_packaged():
    main = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))
    assert 'v54-diagnostics-interpretation.js' in main
    assert 'v54-diagnostics-interpretation.js' in package['build']['files']


def test_diagnostics_explains_skew_kurtosis_outliers_and_likert_guidance():
    src = (ROOT / 'desktop' / 'v54-diagnostics-interpretation.js').read_text(encoding='utf-8')
    assert 'concentración hacia puntuaciones altas; revisar posible efecto techo' in src
    assert 'concentración hacia puntuaciones bajas; revisar posible efecto suelo' in src
    assert 'distribución altamente concentrada' in src
    assert 'posible valor atípico univariado' in src
    assert 'no constituye por sí sola un criterio de eliminación' in src
    assert 'WLSMV/DWLS' in src


def test_diagnostics_builds_semantic_traffic_light_and_downloadable_profile():
    src = (ROOT / 'desktop' / 'v54-diagnostics-interpretation.js').read_text(encoding='utf-8')
    assert 'Semáforo' in src
    assert 'Perfil de distribución de ítems' in src
    assert 'Asimetría por ítem' in src
    assert 'Curtosis por ítem' in src
    assert 'Valor z extremo por ítem' in src
    assert 'ValiStruct_perfil_distribucion_items.svg' in src
    assert 'ValiStruct_perfil_distribucion_items.png' in src
