"""Fase 7 acceptance fixes: desktop AFE routing and content-validity XLSX workflows."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def test_desktop_scientific_base_ignores_stale_web_localstorage():
    app=(ROOT/"app.js").read_text(encoding="utf-8")
    assert "if(window.valistructDesktop?.desktop)return DEFAULT_PRO_API_BASE;" in app
    assert "localStorage.getItem('valistruct_api_base')" in app


def test_afe_r_output_contains_scree_variance_and_rotated_matrices():
    efa=(ROOT/"efa-v52.js").read_text(encoding="utf-8")
    engine=(ROOT/"backend/efa_engine.R").read_text(encoding="utf-8")
    for token in ["efaScreeSvg","efaVarianceExplained","efaRotatedPattern","Matriz de estructura"]:
        assert token in efa
    assert "variance_accounted" in engine
    assert "estimate$Vaccounted" in engine
    assert "respuesta no JSON (HTTP " in efa


def test_content_validity_desktop_xlsx_templates_and_imports_exist():
    bridge=(ROOT/"desktop/excel-import.js").read_text(encoding="utf-8")
    for profile in ["delphi","cvi","lawshe"]:
        assert f"addContentTemplatePanel('{profile}'" in bridge
    for label in [
        "ValiStruct_Plantilla_Delphi.xlsx",
        "ValiStruct_Plantilla_ICVI_SCVI.xlsx",
        "ValiStruct_Plantilla_CVR_Lawshe.xlsx",
        "Generar y descargar plantilla (.xlsx)",
        "Subir plantilla XLSX",
    ]:
        assert label in bridge
    for importer in ["importDelphiRows","importCviRows","importLawsheRows"]:
        assert f"function {importer}" in bridge
