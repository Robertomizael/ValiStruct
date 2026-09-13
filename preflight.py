from pathlib import Path
import importlib.util, shutil, json, sys

mods=["flask","flask_cors","pytest","openpyxl","pyreadstat","docx","xlsxwriter"]
rows=[]
for m in mods:
    rows.append({"dependency":m,"available":importlib.util.find_spec(m) is not None})
rows.append({"dependency":"node","available":shutil.which("node") is not None})
rows.append({"dependency":"Rscript","available":shutil.which("Rscript") is not None})
print(json.dumps(rows,indent=2))
missing=[x["dependency"] for x in rows if not x["available"]]
if missing:
    print("WARN missing runtime/test dependencies:",", ".join(missing))
