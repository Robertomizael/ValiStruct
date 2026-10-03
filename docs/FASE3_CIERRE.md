# ValiStruct v5.4 · Cierre de Fase 3

**Rama de trabajo:** `feature/v5-4-fase3-hardening`  
**Base segura:** `backup/v5-4-fase2-cierre`  
**Versión:** `5.4.0-beta.1` · display `5.4 Beta`  
**Formato de proyecto:** `3.0`  
**Estado:** Fase 3 cerrada técnicamente, pendiente únicamente de conservar el backup de cierre.  
**Regla de publicación:** no fusionar a `main` ni publicar release sin autorización explícita.

## 1. Alcance del cierre

Fase 3 se ejecutó como endurecimiento posterior a Fase 2 con cambios pequeños, reversibles y protegidos por regresión. El trabajo se dividió en:

- 3A — Integridad y rutas de datos.
- 3B — Persistencia y versión.
- 3C — Límites y metadatos.
- 3D — Ciencia y seguridad.

No se modificó `main` y no se alteró el backup seguro de Fase 2.

## 2. Subfase 3A — Integridad y rutas de datos

**Estado: PASS**

- Las importaciones inválidas de Fiabilidad, AFE y AFC ya no sustituyen la base canónica válida.
- Motor Pro reutiliza una sola ruta canónica basada en `ValiStructParticipantData`.
- Se añadieron regresiones específicas para garantizar que un archivo rechazado no destruya datos previamente válidos.
- Se protegió la ruta canónica usada por Motor Pro.

Pruebas principales:
- `tests/test_fase3_rejected_import_preserves_canonical.py`
- `tests/test_fase3_motorpro_canonical_route.py`

## 3. Subfase 3B — Persistencia y versión

**Estado: PASS**

- Los proyectos persisten resultados derivados de:
  - I-CVI / S-CVI;
  - Kappa modificado;
  - Lawshe;
  - Delphi.
- No se duplican matrices crudas de jueces dentro del proyecto.
- Se mantiene compatibilidad con proyectos históricos.
- Versión alineada en web y desktop:
  - `5.4.0-beta.1`
  - display `5.4 Beta`
  - `projectFormat: 3.0`
- Caché PWA rotado.
- Metadatos de release y pruebas de versión alineados.

Pruebas principales:
- `tests/test_fase3_content_validity_project_roundtrip.py`
- `tests/test_fase3_version_metadata.py`

## 4. Subfase 3C — Límites y metadatos

**Estado: PASS**

- El guard de navegación desktop protege explícitamente el operador `||`.
- Delphi mantiene panel fijo: una nueva ronda se bloquea cuando cambia el número de expertos, ítems o escala.
- SAV/DTA conserva:
  - etiquetas de variables;
  - etiquetas de valor;
  - valores numéricos originales sin recodificación.
- La lectura de etiquetas quedó cubierta también por pruebas del backend.

Pruebas principales:
- `tests/test_fase0_desktop_nav_marker.py`
- `tests/test_fase3_delphi_config_lock.py`
- `tests/test_fase2d_legacy_labels_privacy.py`
- `backend/tests/test_legacy_value_labels.py`

## 5. Subfase 3D — Ciencia y seguridad

### 5.1 V de Aiken

**Estado: PASS**

Se corrigió exclusivamente el intervalo de confianza score de Penfield–Giacobbi. El valor puntual de V no cambió.

La implementación usa:

`n × k`

donde:

`k = máximo de la escala − mínimo de la escala`

Caso protegido:
- V = 0.900
- n = 5
- escala 1–5
- k = 4
- IC95 aproximado = 0.698966–0.972134

El golden master fue actualizado deliberadamente para reflejar la corrección científica.

Prueba principal:
- `tests/test_fase3_aiken_score_interval.py`

### 5.2 Latencia / OLS

**Estado: PASS**

Latencia continúa identificándose explícitamente como **regresión lineal OLS preliminar**. No sustituye Motor Pro ni SEM de producción ML/WLSMV.

Se implementó:
- `gl = n − p − 1`;
- p-valores mediante distribución t de Student;
- R²;
- R² ajustado;
- F global;
- p global del modelo;
- salida de β, EE, t, gl y p;
- reporte APA ampliado.

Commits científicos principales:
- `a3ccf8d` — inferencia OLS t/F;
- `1cab34f` — reporte Latencia/APA ampliado;
- `7a2520c` / `0ca0df4` — prueba numérica controlada;
- `082a1c0` — integración al CI.

Prueba principal:
- `tests/test_fase3_latencia_ols.py`

Verificación:
- CI `082a1c0`: PASS.
- RC de Latencia: PASS.
- Desktop Build `1cab34f`: macOS PASS y Windows PASS.

### 5.3 Token efímero para backend científico desktop

**Estado: PASS**

Se añadió protección local por sesión sin introducir login institucional obligatorio.

Flujo:
1. Electron genera un token aleatorio por sesión con `crypto.randomBytes(32)`.
2. `desktop/main.js` lo pasa al backend mediante `VALISTRUCT_DESKTOP_SESSION_TOKEN`.
3. `desktop/preload.js` lo expone de forma controlada mediante `contextBridge`.
4. El frontend adjunta `X-ValiStruct-Session` a las solicitudes científicas locales.
5. El backend exige el token solamente cuando la variable de protección desktop está presente.
6. `/health` y `/version` permanecen disponibles para sondeo de arranque.
7. El preflight CORS permanece disponible.
8. Web/desarrollo conserva el comportamiento previo cuando no existe token de sesión.

Casos de seguridad protegidos:
- sin token → 401;
- token incorrecto → 401;
- token correcto → atraviesa el gate;
- modo web/desarrollo sin token configurado → comportamiento previo intacto.

Pruebas principales:
- `backend/tests/test_desktop_session_token.py`
- `tests/test_fase3_desktop_session_token.py`

Commits principales:
- `be11dd8` — generación del token;
- `a6bdba9` — bridge preload;
- `fdd4fc9` — gate backend;
- `2664913` — token en solicitudes científicas;
- `d64fc78` — preflight CORS;
- `f557768` — prueba del gate;
- `f6c4940` — prueba del bridge/frontend;
- `42ba559` — gate en CI;
- `ffb2c03` — aislamiento del arnés del menú contextual respecto al nuevo IPC.

Verificación:
- CI `ffb2c03`: PASS.
- RC `ffb2c03`: PASS.
- Desktop Build `f557768`: Windows PASS y macOS PASS.
- Los commits posteriores a `f557768` que afectan este cierre son únicamente pruebas/configuración de CI y no modifican el código de producción desktop del token.

## 6. Auditoría técnica final contra Fase 2

Comparación:

`backup/v5-4-fase2-cierre ... feature/v5-4-fase3-hardening`

Resultado previo al commit de este documento:
- base: `d78cb2419c9eebe41aa342a7d065c749438d28aa`;
- rama Fase 3: `ffb2c03075a752f0a5359251c22a58fb25789c93`;
- estado: `ahead`;
- commits por delante: 52;
- commits por detrás: 0;
- merge-base: exactamente el backup de Fase 2.

Conclusiones de auditoría:
- no existe divergencia respecto al backup seguro;
- no se requiere rebase ni merge para cerrar Fase 3;
- los cambios científicos tienen pruebas específicas;
- las pruebas no fueron relajadas para obtener CI verde;
- el cambio de Aiken está protegido por caso numérico explícito;
- Latencia permanece delimitada como OLS preliminar;
- el token desktop no altera el modo web/desarrollo sin protección;
- el backup de Fase 2 permanece intacto;
- `main` permanece fuera del cierre.

## 7. Gates de cierre

Estado observado antes de este commit documental:

| Gate | Estado |
|---|---|
| Fase 3A | PASS |
| Fase 3B | PASS |
| Fase 3C | PASS |
| Aiken | PASS |
| Latencia OLS | PASS |
| Token desktop | PASS |
| CI final código `ffb2c03` | PASS |
| RC final código `ffb2c03` | PASS |
| Desktop Windows con producción del token | PASS |
| Desktop macOS con producción del token | PASS |
| Merge a `main` | NO REALIZADO |
| Release | NO PUBLICADO |

El commit documental de cierre deberá conservar CI y RC verdes antes de crear el backup final.

## 8. Limitaciones deliberadas

- Latencia no es SEM de producción.
- Motor Pro conserva su papel como motor científico principal.
- No se añadió autenticación institucional obligatoria para uso desktop local.
- No se fusionó Fase 3 a `main`.
- No se publicó release.
- No se modificó el backup de Fase 2.

## 9. Acción final de Fase 3

Una vez que el commit de este documento obtenga gates verdes:

1. confirmar HEAD de `feature/v5-4-fase3-hardening`;
2. confirmar CI y RC;
3. crear `backup/v5-4-fase3-cierre` apuntando exactamente a ese HEAD;
4. verificar que el backup nuevo y la rama de Fase 3 apunten al mismo commit;
5. no realizar merge a `main`.

Con ese backup, Fase 3 queda cerrada definitivamente.
