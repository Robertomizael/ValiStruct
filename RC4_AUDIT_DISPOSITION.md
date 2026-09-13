# ValiStruct 3.0 RC4 — Disposición de hallazgos de auditoría

## Corregidos en RC4
- C1: verificación de convergencia, post-check, advertencias reales de lavaan y Heywood.
- C2: exposición separada de índices estándar y robustos/escalados cuando lavaan los ofrece.
- C3: Docker y script Unix pasan a Gunicorn.
- A1: rutas principales de cómputo/exportación quedan protegidas cuando `AUTH_ENABLED=true`.
- A2: límites server-side para Monte Carlo (`n` y `reps`).
- A4: el módulo web deja visible que la extracción es ACP prototipo y no AFE común.
- A5: se retira el “Omega” web incorrecto hasta disponer de un cálculo factorial auténtico.
- A6: HTMT usa policóricas cuando todos los indicadores del modelo son ordinales.
- A7: PBKDF2-SHA256 con sal como formato recomendado; SHA-256 legado solo para migración.
- M1: TTL de token y rate limit básico de login.
- M4: `ordinal_vars` explícitas cuando se suministran.
- M5: manejo de missing explícito con advertencia de sustitución.
- M6: alerta de Heywood en CR/AVE.
- M7: Service Worker cachea solo app shell; API queda network-only.
- M8: `expected_revision` se valida y la escritura de proyecto es atómica.
- M12: `rc_check` prueba realmente que lavaan esté instalado en R.

## Corregidos parcialmente
- A3: se añade `portalocker`, escritura atómica, bloqueo en actualización de proyecto y transacciones bloqueadas para actividad/notificaciones. **Corrección parcial**: otros almacenes JSON heredados aún deben migrarse a transacciones bloqueadas o una base de datos.
- C3: Gunicorn evita depender del servidor de desarrollo. El cómputo R continúa siendo síncrono; para una instalación grande sigue recomendándose una cola de trabajos.

## Pendientes para RC5 o beta técnica
- M2: política estricta de etiquetas compartidas en Monte Carlo.
- M9: df aproximado de `model_check.R` para modelos con restricciones de medias.
- M10: unificar/documentar autorización de cambio de estado de tareas.
- M11: limpiar dependencias R no utilizadas.
- B1: optional chaining uniforme.
- B2: hacer CORS cerrado por defecto en modo producción.
- B4: prueba automatizada específica de ZIP path traversal.
- Migrar almacenamiento colaborativo JSON a SQLite/PostgreSQL antes de una instalación multiusuario de mayor escala.
