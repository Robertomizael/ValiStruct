# ValiStruct v5.4 · Cierre de Fase 5 — Candidate validation

**Rama:** `feature/v5-4-fase5-candidate-validation`  
**Base segura:** `backup/v5-4-fase4-cierre`  
**Versión:** `5.4.0-beta.1`  
**Estado:** Fase 5 cerrada técnicamente.  
**Regla:** no hacer merge a `main` ni publicar release sin autorización explícita.

## 1. Objetivo

Preservar la trazabilidad verificable del candidato ValiStruct 5.4 Beta 1 sin modificar ciencia ni publicar artefactos como release.

## 2. Candidato registrado

Se creó:

`release/candidate-v5.4-beta1.json`

con:

- versión;
- formato de proyecto;
- commit de producción usado para generar instaladores;
- HEAD validado de Fase 4;
- workflow run ID;
- artifact IDs;
- tamaños exactos;
- SHA-256 de los ZIP de GitHub Actions;
- fecha de expiración;
- `published=false`;
- `mergedToMain=false`.

## 3. Artefactos

Build de producción:

`538bca5d553e7df9f0b6e02514a483448d207239`

Workflow:

`37145587046`

### macOS
- artifact: `valistruct-desktop-macos-autonomous`
- artifact ID: `11281679660`
- tamaño: `573004166` bytes
- SHA-256 ZIP:
  `be707d200986d2e7395c36c074d3ead30c014c3c3ac0e63ce32f262845fdf8b2`
- build: PASS

### Windows
- artifact: `valistruct-desktop-windows-autonomous`
- artifact ID: `11281584970`
- tamaño: `779603487` bytes
- SHA-256 ZIP:
  `6bc7b3ca8a1b35c968d6626d1543bbd3c437785e61250ce3e8b7c4d12d28b752`
- build: PASS

## 4. Coherencia con el HEAD validado

Desde el commit de producción `538bca5` hasta el cierre de Fase 4 `b4a4503` solo cambiaron:

- documentación;
- pruebas de release-readiness.

No hubo cambios posteriores en el código de producción desktop.

Por ello, los instaladores validados representan el estado productivo del candidato.

## 5. Gates de candidato

Se añadió:

`tests/test_fase5_candidate_manifest.py`

que verifica:

- versión 5.4.0-beta.1;
- display 5.4 Beta;
- projectFormat 3.0;
- source commit exacto;
- validated head exacto;
- workflow run ID exacto;
- artifact IDs exactos;
- tamaños exactos;
- formato SHA-256 de 64 hexadecimales;
- plataformas macOS y Windows;
- estado no publicado;
- estado no fusionado a main.

La prueba fue integrada en:

- Unified CI;
- RC Validation.

## 6. Gates finales

HEAD funcional validado:

`e11f37b6ba187fb13511b04395b092138fe55c73`

- Unified CI: PASS.
- RC Validation: PASS.
- Desktop Build heredado del candidato de producción:
  - macOS: PASS.
  - Windows: PASS.

No se requirió un nuevo Desktop Build en Fase 5 porque los cambios de esta fase se limitaron a manifiesto, documentación, pruebas y workflows.

## 7. Auditoría contra Fase 4

Comparación previa al commit de este documento:

`backup/v5-4-fase4-cierre ... feature/v5-4-fase5-candidate-validation`

Resultado:
- base: `b4a450365727d86c8dc9b404b04d9112cceb10ee`;
- estado: `ahead`;
- commits por delante: 7;
- commits por detrás: 0;
- merge-base: exactamente el backup de Fase 4.

## 8. Límites deliberados

- No se modificaron cálculos científicos.
- No se modificó código de producción de la app.
- No se publicó GitHub Release.
- No se realizó merge a `main`.
- No se cambió la versión.
- No se creó firma comercial/notarización.
- Los artefactos de Actions tienen expiración y no sustituyen un release publicado.

## 9. Próximo punto de control

Una vez que este documento tenga CI verde:

1. crear `backup/v5-4-fase5-cierre`;
2. verificar que rama y backup apunten al mismo commit;
3. confirmar que `main` permanezca intacto;
4. detener el proceso automático.

El siguiente paso natural —merge/publicación/promoción del candidato— requiere autorización explícita.
