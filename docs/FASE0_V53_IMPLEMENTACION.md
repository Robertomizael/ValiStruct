# ValiStruct v5.3 · Fase 0 — Blindaje antes de simplificar

**Autor conceptual y director científico:** Dr. Roberto Joel Tirado Reyes  
**Base:** `hotfix/v5-2-4-motorpro-numerics-contextmenu` (`38084251d1456b39a173d6520ef6e30c8554b40a`)  
**Rama de trabajo:** `feature/v5-3-simplificacion`  
**Estado:** Fase 0 en validación. No fusionar ni publicar.

## Objetivo
Crear una red de seguridad verificable antes de reducir la navegación. Esta fase no cambia la arquitectura científica ni elimina módulos.

## Implementado
- Workflow único `.github/workflows/valistruct-ci.yml` en PR a `main` y pushes `feature/**` / `hotfix/**`.
- R y paquetes científicos obligatorios, más pruebas JS, Python, backend, Playwright, AFE-R y Motor Pro/lavaan.
- Actualización de `test_v51_stage1.py` para conservar sus pruebas del DataManager con la navegación actual.
- Barrido de todas las secciones para detectar `pageerror`.
- Auditoría de enlaces cruzados.
- Corrección de `validation → aiken` y `home → inicio`.
- `projectState()` mantiene semántica `|| null` sin depender de funciones opcionales inexistentes.
- Marca neutral `data-valistruct-nav="v5"`; Electron conserva temporalmente el fallback `v51Grouped`.
- Backend en modo científico por defecto mediante lista blanca; capacidades institucionales requieren `VALISTRUCT_INSTITUTIONAL_MODE=true`.
- Pruebas del bloqueo institucional.
- Roundtrip de proyectos y minimización de datos crudos.
- Generador de fixtures históricos que ejecuta las revisiones originales en Chromium.
- Maestro dorado numérico para alfa, ACP/autovalores, KMO, Bartlett, Mahalanobis, Mardia y el IC de Aiken actual.
- Capturas de referencia no bloqueantes.
- Caché PWA rotada por cambios de Fase 0.

## Deliberadamente no modificado
Aiken, AFE, AFC, fiabilidad, Motor Pro/lavaan, Mahalanobis/Mardia, `participant-data.js`, `jasp-import.js`, `efa-v52.js`, IDs del núcleo, Latencia/OLS, esquema `projectFormat` y cálculos R.

## Pendiente para cerrar la Fase 0
1. Todo el CI unificado debe quedar verde en el HEAD final.
2. Generar/validar los fixtures históricos desde el historial completo.
3. Confirmar DMG y EXE de la rama sin reaparición del shell antiguo.
4. Revisión independiente de Claude del diff de Fase 0.

## Fase 1 (todavía no implementada)
- `NAV_MODULES` como fuente declarativa única.
- ≤25 entradas principales.
- Módulos integrados alcanzables desde su padre en ≤2 clics.
- Admin oculto; QA no visible.
- Validación externa marcada `En preparación`.
- Sin eliminación física de DOM/JS.
