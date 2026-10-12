from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HARDENING = (ROOT / 'desktop' / 'content-validity-xlsx-hardening.js').read_text(encoding='utf-8')
RENDERER = (ROOT / 'desktop' / 'content-validity-xlsx-renderer.js').read_text(encoding='utf-8')


def test_validation_is_structure_based_not_filename_only():
    assert 'function spreadsheetName(file)' in HARDENING
    assert "typeof file.arrayBuffer!=='function'" in HARDENING
    assert 'const m=matrixInfo(rows)' in HARDENING
    assert 'inferProfile(meta,m)' in HARDENING
    assert "if(!/\\.xlsx$/i.test(file.name))" not in HARDENING


def test_legacy_schema_is_accepted_when_matrix_is_valid():
    # Legacy workbooks remain valid when their matrix structure is valid.
    # Schema markers may trigger a warning, but they are not a hard rejection.
    assert 'if(schema&&schema!==SCHEMA)console.warn' in HARDENING
    assert "legacy:!schema" in HARDENING
    assert "if(schema!==SCHEMA)throw" not in HARDENING
    assert 'const m=matrixInfo(rows)' in HARDENING


def test_renderer_reads_excel_by_content_and_supports_xls_xlsx():
    assert 'function spreadsheetName(file)' in RENDERER
    assert 'new Uint8Array(await file.arrayBuffer())' in RENDERER
    assert 'parseSpreadsheet(spreadsheetName(file),bytes)' in RENDERER
    assert 'accept=".xlsx,.xls' in RENDERER
    assert "if(!/\\.xlsx$/i.test(file.name))" not in RENDERER


def test_all_content_validity_modules_keep_real_matrix_validation():
    assert "addControls('cviWorkspace','cvi'" in RENDERER
    assert "addControls('lawsheWorkspace','lawshe'" in RENDERER
    assert "addControls('delphiWorkspace','delphi'" in RENDERER
    assert 'validateNumericRatings(m.data,min,max' in RENDERER
    assert 'lawValue(v)' in RENDERER
    assert 'Ronda ${round} importada.' in RENDERER
