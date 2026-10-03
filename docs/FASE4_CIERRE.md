# ValiStruct v5.4 · Cierre de Fase 4 — Release readiness

**Rama:** `feature/v5-4-fase4-release-readiness`  
**Base segura:** `backup/v5-4-fase3-cierre`  
**Versión:** `5.4.0-beta.1` · display `5.4 Beta`  
**Formato de proyecto:** `3.0`  
**Estado:** Fase 4 cerrada técnicamente.  
**Regla:** no fusionar a `main` ni publicar release sin autorización explícita.

## 1. Objetivo

Preparar ValiStruct 5.4 Beta para promoción futura sin incorporar nuevas funciones científicas ni cambios metodológicos.

## 2. Coherencia de release

Se alinearon las superficies activas con ValiStruct 5.4 Beta:

- `version.json`:
  - `5.4.0-beta.1`;
  - display `5.4 Beta`;
  - `projectFormat: 3.0`;
  - `releaseChannel: beta`;
  - `featureFreeze: true`.
- README actualizado desde referencias antiguas 3.0/3.0.1.
- Banner visible actualizado de v5.3 a v5.4 Beta.
- `VERSION_INFO` de `app.js` actualizado a `5.4.0-beta.1`.
- Cache PWA rotado a:
  - `valistruct-v5-4-0-beta1-fase4-20261003`.

## 3. Beta gate actual

Se retiró la dependencia lógica del identificador histórico RC6:

- `tests/validate_release.py` obtiene la versión directamente desde `version.json`;
- el reporte actual se escribe como `tests/BETA_VALIDATION_REPORT.json`;
- `tests/beta_gate.py` comprueba que el reporte corresponda exactamente a la versión activa;
- un reporte perteneciente a otra versión bloquea la promoción;
- RC Validation ejecuta:
  - `python tests/validate_release.py`
  - `python tests/beta_gate.py`

La prueba `tests/test_fase4_release_readiness.py` protege esta coherencia.

## 4. Reproducibilidad desktop

Se habilitó la rama de Fase 4 en el workflow autónomo de desktop.

Las dependencias directas fueron fijadas a versiones exactas:

- `tar = 7.4.3`
- `xlsx = 0.18.5`
- `electron = 32.1.2`
- `electron-builder = 25.1.8`

No se fabricó un `package-lock.json`: el entorno local utilizado para la auditoría no disponía de resolución de red para npm. Se conserva `npm install` y se protege por prueba que las dependencias directas permanezcan exactas.

Esta limitación queda explícita y no se representa falsamente como reproducibilidad transitoria completa.

## 5. Incidencia detectada durante Fase 4

Un CI de `e8a01fb` falló porque la prueba heredada de Fase 3 exigía exactamente el cache:

`valistruct-v5-4-0-beta1-fase3-20261002`

al haberse rotado deliberadamente a:

`valistruct-v5-4-0-beta1-fase4-20261003`

La prueba no fue relajada. La expectativa exacta fue actualizada en `24f9ec9`.

Resultado posterior:
- CI `24f9ec9`: PASS.
- RC `24f9ec9`: PASS.

Las ejecuciones con estado `cancelled` observadas durante esta fase correspondieron al control de concurrencia `cancel-in-progress: true` al llegar commits posteriores y no se contaron como gates verdes.

## 6. Gates finales de Fase 4

HEAD funcional validado:
`fec808a56e137cedb65418b52221c8a0da50af26`

- Unified CI: PASS.
- RC Validation: PASS.

Desktop Build asociado al cambio de producción de dependencias:
`538bca5d553e7df9f0b6e02514a483448d207239`

- macOS: PASS.
- Windows: PASS.

Los commits posteriores hasta `fec808a` contienen únicamente pruebas de gate y no modifican el código de producción desktop.

## 7. Auditoría contra Fase 3

Comparación previa al commit de este documento:

`backup/v5-4-fase3-cierre ... feature/v5-4-fase4-release-readiness`

Resultado:
- base: `6e78c3a62d2c493081c94114bea0e1fa0cb79590`;
- estado: `ahead`;
- commits por delante: 17;
- commits por detrás: 0;
- merge-base: exactamente el backup de Fase 3.

No existe divergencia respecto al backup seguro.

## 8. Límites deliberados

- No se incorporaron nuevas funciones científicas.
- No se cambiaron fórmulas ni métodos estadísticos.
- No se tocó Motor Pro científicamente.
- No se hizo merge a `main`.
- No se publicó release.
- No se modificó `backup/v5-4-fase3-cierre`.
- La ausencia de lockfile transitivo permanece documentada; no se falsificó uno.

## 9. Acción final

Después de que el commit documental de cierre tenga CI verde:

1. confirmar HEAD;
2. crear `backup/v5-4-fase4-cierre`;
3. verificar que backup y rama apunten al mismo commit;
4. confirmar nuevamente que `main` permanece intacto;
5. no publicar release ni hacer merge.

Con ello Fase 4 queda cerrada definitivamente.
