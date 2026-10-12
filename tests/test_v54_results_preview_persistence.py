from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATCH = (ROOT / 'desktop' / 'v54-results-preview-fix.js').read_text(encoding='utf-8')
MAIN = (ROOT / 'desktop' / 'main-patched.js').read_text(encoding='utf-8')
PACKAGE = (ROOT / 'desktop' / 'package.json').read_text(encoding='utf-8')


def test_results_preview_isolated_from_results_mutation_observer():
    assert 'MutationObserver -> capture() -> render() loop' in PATCH
    assert "document.createElement('iframe')" in PATCH
    assert 'frame.srcdoc=' in PATCH
    assert 'vsPreviewBypass' in PATCH


def test_results_preview_fix_is_injected_and_packaged():
    assert "'v54-results-preview-fix.js'" in MAIN
    assert '"v54-results-preview-fix.js"' in PACKAGE
