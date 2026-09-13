# ValiStruct 3.0 RC2 — Correcciones

## Defecto crítico corregido
En RC1, `backend/api.py` inicializaba `APP_STARTED_AT = time.time()` sin importar `time`.
El mismo archivo utilizaba posteriormente `secrets`, `hashlib` y `Path` sin imports garantizados.

RC2 añade explícitamente:
- `import time`
- `import secrets`
- `import hashlib`
- `from pathlib import Path`

## CORS
RC1 documentaba `VALISTRUCT_ALLOWED_ORIGINS`, pero el backend seguía ejecutando `CORS(app)` sin aplicar esa variable.
RC2 aplica la lista configurada de orígenes al middleware CORS.

Sin `VALISTRUCT_ALLOWED_ORIGINS`, permanece un modo abierto únicamente para desarrollo local.

## Encabezados
Se añaden:
- `Permissions-Policy`
- `X-Permitted-Cross-Domain-Policies`

## Pruebas
`tests/release_check.py` ahora detecta imports críticos faltantes y desajustes de versión.

La ejecución completa de `pytest` sigue requiriendo instalar primero las dependencias de `backend/requirements.txt`.
