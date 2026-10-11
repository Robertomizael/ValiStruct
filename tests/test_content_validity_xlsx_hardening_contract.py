from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def test_hardening_layer_is_packaged_and_injected():
    package = json.loads((ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8'))
    assert 'content-validity-xlsx-hardening.js' in package['build']['files']
    patched = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    assert 'content-validity-xlsx-hardening.js' in patched


def test_expert_templates_carry_profile_schema_and_identification():
    src = (ROOT / 'desktop' / 'content-validity-xlsx-hardening.js').read_text(encoding='utf-8')
    for token in (
        "content-validity-xlsx-v1",
        "VALISTRUCT_PROFILE",
        "VALISTRUCT_SCHEMA",
        "IDENTIFICACIÓN DE EXPERTOS",
        "'cvi'",
        "'lawshe'",
        "'delphi'",
    ):
        assert token in src


def test_upload_hardening_rejects_wrong_profile_and_changed_structure():
    src = (ROOT / 'desktop' / 'content-validity-xlsx-hardening.js').read_text(encoding='utf-8')
    assert 'profile!==expected' in src
    assert 'expectedJudges!==m.judges' in src
    assert 'expectedItems!==m.items' in src
    assert 'numeración consecutiva desde 1' in src
