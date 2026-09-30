"""Fase 0 static audit of navigation destinations and keyboard shortcuts."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/"index.html").read_text(encoding="utf-8")
app=(ROOT/"app.js").read_text(encoding="utf-8")
shell=(ROOT/"v52-shell.js").read_text(encoding="utf-8")
ux=(ROOT/"desktop"/"ux-shell.js").read_text(encoding="utf-8")

section_ids=set(re.findall(r'<section\s+id="([^"]+)"',html))
dynamic_ids=set(re.findall(r"\{id:'([^']+)',title:",shell))
all_sections=section_ids|dynamic_ids

destinations=[]
def add(source,kind,values):
    for value in values:
        destinations.append((source,kind,value))

add("index.html","data-go",re.findall(r'data-go="([^"]+)"',html))
add("index.html","data-section",re.findall(r'data-section="([^"]+)"',html))
add("v52-shell.js","data-vs-target",re.findall(r'data-vs-target="([^"]+)"',shell))
add("app.js","section",re.findall(r"section\s*:\s*['\"]([^'\"]+)['\"]",app))
# Literal keyboard map used for Alt+number shortcuts.
for body in re.findall(r"const\s+map\s*=\s*\{([^}]+)\}",app):
    add("app.js","keyboard-map",re.findall(r"['\"]\d+['\"]\s*:\s*['\"]([^'\"]+)['\"]",body))
# Desktop legacy shell's explicit data-section references.
add("desktop/ux-shell.js","data-section",re.findall(r'data-section=["\']([^"\']+)["\']',ux))

missing=sorted({(src,kind,value) for src,kind,value in destinations
                if value and "${" not in value and value not in all_sections})
assert not missing, "Broken navigation destinations: "+repr(missing)
