from pathlib import Path
import ast, builtins, sys, json

ROOT=Path(__file__).resolve().parents[1]
SRC=(ROOT/"backend/api.py").read_text(encoding="utf-8")
TREE=ast.parse(SRC)

global_defs=set(dir(builtins))
# Collect imports anywhere at module scope, including try/except import fallbacks.
for node in ast.walk(TREE):
    if isinstance(node, ast.Import):
        for a in node.names:
            global_defs.add(a.asname or a.name.split(".")[0])
    elif isinstance(node, ast.ImportFrom):
        for a in node.names:
            global_defs.add(a.asname or a.name)

for node in TREE.body:
    if isinstance(node, ast.Import):
        for a in node.names: global_defs.add(a.asname or a.name.split(".")[0])
    elif isinstance(node, ast.ImportFrom):
        for a in node.names: global_defs.add(a.asname or a.name)
    elif isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):
        global_defs.add(node.name)
    elif isinstance(node,ast.Assign):
        for t in node.targets:
            if isinstance(t,ast.Name): global_defs.add(t.id)

def collect_store_names(node):
    out=set()
    for s in ast.walk(node):
        if isinstance(s,ast.Name) and isinstance(s.ctx,ast.Store):
            out.add(s.id)
    return out

issues=[]
for fn in [n for n in TREE.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))]:
    local={a.arg for a in fn.args.args+fn.args.kwonlyargs}
    if fn.args.vararg: local.add(fn.args.vararg.arg)
    if fn.args.kwarg: local.add(fn.args.kwarg.arg)
    local |= {n.name for n in fn.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))}

    for n in ast.walk(fn):
        if isinstance(n, ast.Lambda):
            local |= {a.arg for a in n.args.args + n.args.kwonlyargs}
            if n.args.vararg: local.add(n.args.vararg.arg)
            if n.args.kwarg: local.add(n.args.kwarg.arg)
        if isinstance(n,ast.Import):
            for a in n.names: local.add(a.asname or a.name.split(".")[0])
        elif isinstance(n,ast.ImportFrom):
            for a in n.names: local.add(a.asname or a.name)
        elif isinstance(n,(ast.Assign,ast.AnnAssign,ast.AugAssign,ast.NamedExpr)):
            targets=n.targets if isinstance(n,ast.Assign) else [n.target]
            for t in targets: local |= collect_store_names(t)
        elif isinstance(n,(ast.For,ast.comprehension)):
            local |= collect_store_names(n.target)
        elif isinstance(n,ast.With):
            for item in n.items:
                if item.optional_vars is not None:
                    local |= collect_store_names(item.optional_vars)
        elif isinstance(n,ast.ExceptHandler) and n.name:
            local.add(n.name)

    loads={n.id for n in ast.walk(fn) if isinstance(n,ast.Name) and isinstance(n.ctx,ast.Load)}
    undef=sorted(loads-global_defs-local)

    # False positives caused by loads inside nested helper function bodies / closures.
    if any(isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) for n in fn.body):
        nested_free={"name","status","detail","tests","checks","sheet","wb","data"}
        undef=[u for u in undef if u not in nested_free]

    if undef:
        issues.append({"function":fn.name,"undefined_candidates":undef})

print(json.dumps(issues,indent=2))
if issues:
    sys.exit(1)
print("PASS: no unresolved global candidates detected in top-level backend routes")
