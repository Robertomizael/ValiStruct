# Estado de hallazgos — RC5

## Nuevas correcciones
- M2: Monte Carlo calcula sesgo solo para parámetros con etiquetas explícitas compartidas.
- M9: Model Check declara explícitamente la limitación de df aproximados.
- M10: reglas de cambio de estado de tareas unificadas para asignado/creador/admin/editor.
- M11: `plumber` retirado de instalación R; `semTools` queda reservado y documentado.
- B2: CORS pasa a fail-closed en modos production/institutional/beta.
- B4: se añade prueba de path traversal para restauración ZIP.

## Sigue pendiente
- A3: migración completa de almacenes colaborativos JSON a una capa transaccional robusta.
- C3: cola de trabajos para cómputo R pesado en despliegues con alta concurrencia.
- B1: homogeneizar optional chaining del DOM.
- Ejecutar la batería completa en un entorno con R/lavaan, Flask y Docker.
