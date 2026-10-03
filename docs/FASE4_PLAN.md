# ValiStruct v5.4 · Fase 4 — Release readiness

**Rama:** `feature/v5-4-fase4-release-readiness`  
**Base segura:** `backup/v5-4-fase3-cierre`  
**Regla:** no tocar `main`, no hacer merge y no publicar release sin autorización explícita.

## Objetivo

Preparar ValiStruct 5.4 Beta para una eventual promoción sin introducir nuevas funciones científicas ni cambios metodológicos.

## Bloques

### 4A — Coherencia de release
- alinear README, versión visible y metadatos;
- congelar funciones durante esta fase;
- modernizar el beta gate para que use la versión actual y no artefactos RC6 heredados;
- impedir que un reporte de otra versión habilite la promoción.

### 4B — Reproducibilidad
- ejecutar CI completo;
- ejecutar RC Validation;
- compilar instaladores autónomos Windows y macOS desde esta rama;
- comprobar artefactos y resultados de build.

### 4C — Auditoría de salida
- revisar dependencias y configuración de seguridad sin alterar políticas científicas;
- revisar que no existan marcadores de versión obsoletos en superficies activas;
- documentar limitaciones deliberadas y criterios de promoción.

## Criterios de cierre

- CI verde.
- RC verde.
- Windows verde.
- macOS verde.
- beta gate ligado a `version.json`.
- ninguna prueba obligatoria relajada o eliminada.
- sin cambios científicos nuevos.
- backup final de Fase 4 creado desde HEAD verde.
- `main` intacto y sin release publicado.
