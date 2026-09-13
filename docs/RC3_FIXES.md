# ValiStruct 3.0 RC3 — Correcciones

## Hallazgo de RC2
La auditoría estática detectó un fallo real de ejecución:

- `audit_package()`
- `admin_backup()`

ambos llamaban `send_file(...)` sin una importación global garantizada. Otras funciones importaban `send_file` localmente, pero esas importaciones no están disponibles en el ámbito global de Python.

## Corrección
RC3 importa `send_file` directamente desde Flask en el encabezado del backend.

## Nuevas verificaciones
Se agregan:
- `tests/static_backend_audit.py`
- `tests/static_frontend_audit.py`
- endpoint `/runtime-audit`

El release checker ejecuta ahora las auditorías estáticas adicionales.

## Alcance
No se agregaron funcionalidades científicas nuevas. RC3 mantiene el congelamiento funcional.
