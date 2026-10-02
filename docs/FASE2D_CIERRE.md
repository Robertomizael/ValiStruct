# ValiStruct v5.4 · Cierre técnico Subfase 2D — Privacidad, importación heredada y builds desktop

**Rama:** `feature/v5-4-fase2d-privacidad-importacion`  
**Base:** `backup/v5-4-fase2c-cierre`  
**Estado:** Subfase 2D cerrada técnicamente. No fusionar a `main` sin autorización explícita.

## Objetivos cerrados

### 1. Privacidad fail-closed
- Sin consentimiento explícito, los datos crudos no se serializan en proyectos.
- `semData` y `proCsvText` quedan fuera del proyecto por defecto.
- El comportamiento está protegido por regresión automática.

### 2. SAV / DTA
- El backend convierte SAV y DTA a CSV mediante `pyreadstat`.
- Se preservan etiquetas de variables cuando están disponibles.
- La fuente convertida se registra en el almacén canónico de participantes.
- Diagnóstico, AFE y Motor Pro reutilizan la misma base central.
- No se crean copias paralelas innecesarias.

### 3. Proyectos históricos
- Fixtures históricos v3.0-rc6 y v5.2.4 siguen restaurando sin errores.
- El estado actual conserva `schemaVersion = 3.0`.
- La compatibilidad histórica permanece dentro del CI unificado.

### 4. Desktop
- Build macOS autónomo: PASS.
- Build Windows autónomo: PASS.
- DMG y EXE se generan desde la rama de cierre 2D.

## Regresiones relevantes
- `tests/test_hotfix_startup_privacy.py`
- `tests/test_fase0_historical_projects.py`
- `tests/test_fase2d_legacy_labels_privacy.py`

## Gates finales
- [x] CI unificado PASS — commit `2fe4ac3`, run 36974145063.
- [x] RC Validation PASS — commit `02dd4fa`, run 36974079955.
- [x] Desktop macOS PASS — run 36974145028.
- [x] Desktop Windows PASS — run 36974145028.
- [x] Privacidad fail-closed verificada.
- [x] Etiquetas SAV/DTA preservadas en almacén canónico.
- [x] Proyectos históricos restauran.
- [x] Base de jueces permanece independiente de participantes.

## Restricción
No fusionar a `main` todavía. El siguiente paso es el cierre global de Fase 2.
