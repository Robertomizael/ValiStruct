from pathlib import Path
import re, sys, json
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/"index.html").read_text(encoding="utf-8")
js=(ROOT/"app.js").read_text(encoding="utf-8")

sections=set(re.findall(r'<section id="([^"]+)"',html))
nav=set(re.findall(r'data-section="([^"]+)"',html))
go=set(re.findall(r'data-go="([^"]+)"',html))
missing_nav=sorted(nav-sections)
missing_go=sorted(go-sections)

ids_html=set(re.findall(r'id="([^"]+)"',html))
ids_js=set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)",js))
# efaScree is generated dynamically in renderEFA and is therefore expected.
missing_ids=sorted((ids_js-ids_html)-{"efaScree"})

result={"missing_nav":missing_nav,"missing_go":missing_go,"missing_literal_dom_ids":missing_ids}
print(json.dumps(result,indent=2))
if missing_nav or missing_go or missing_ids:
    sys.exit(1)
print("PASS: frontend section/navigation/DOM literal audit")
