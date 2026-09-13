# Pruebas E2E

Instalación:
```bash
pip install pytest playwright
playwright install chromium
```

Servir frontend:
```bash
python -m http.server 8000
```

Ejecutar:
```bash
VALISTRUCT_FRONTEND_URL=http://127.0.0.1:8000 pytest -q tests/test_e2e_playwright.py
```
