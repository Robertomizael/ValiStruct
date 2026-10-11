from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_desktop_entry_loads_runtime_content_validity_patch():
    main = (ROOT / "desktop" / "main-patched.js").read_text(encoding="utf-8")
    package = (ROOT / "desktop" / "package.json").read_text(encoding="utf-8")
    patch = "v54-content-validity-runtime-fix.js"
    assert patch in main
    assert patch in package


def test_xlsx_uploads_trigger_the_real_method_calculations():
    src = (ROOT / "desktop" / "v54-content-validity-runtime-fix.js").read_text(encoding="utf-8")
    expected = {
        "cviUploadXlsx": "calculateCvi",
        "lawsheUploadXlsx": "calculateLawshe",
        "delphiUploadXlsx": "calculateDelphi",
    }
    for upload_id, calculate_id in expected.items():
        assert upload_id in src
        assert calculate_id in src
    assert "XLSX importado correctamente" in src
    assert "Ronda\\s+\\d+\\s+importada" in src


def test_scientific_navigation_starts_with_content_validity_then_data_then_construct():
    src = (ROOT / "desktop" / "v54-content-validity-runtime-fix.js").read_text(encoding="utf-8")
    stages = [
        "Etapa I · Validez de contenido",
        "Etapa II · Base de datos y preparación",
        "Etapa III · Validez de constructo y fiabilidad",
        "Etapa IV · Validación externa",
    ]
    positions = [src.index(stage) for stage in stages]
    assert positions == sorted(positions)
    assert "['aiken']" in src
    assert "['dataimport', 'diagnostics', 'multidiag', 'missingpro']" in src
    assert "['efa', 'cfa', 'reliability']" in src
