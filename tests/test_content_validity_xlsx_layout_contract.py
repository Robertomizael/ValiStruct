from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_xlsx_controls_are_normalized_into_each_method_panel():
    src = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
    for pair in (
        "['cviWorkspace','cviXlsxControls']",
        "['lawsheWorkspace','lawsheXlsxControls']",
        "['delphiWorkspace','delphiXlsxControls']",
    ):
        assert pair in src
    assert "anchor.insertAdjacentElement('afterend',box)" in src
