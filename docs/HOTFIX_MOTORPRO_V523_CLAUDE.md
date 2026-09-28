# ValiStruct v5.2.3 Beta — recuperación de Motor Pro R/lavaan

**Director científico:** Dr. Roberto Joel Tirado Reyes · Autor conceptual y director científico.

## Incidencia reproducida
En la aplicación de escritorio el módulo Motor Pro conservaba la sintaxis y los controles visibles, pero el usuario reportó que el botón de ejecución había dejado de producir resultados aunque antes funcionaba. La revisión encontró dos rutas de ejecución distintas para el mismo botón: la lógica principal de `app.js` y un segundo interceptor inyectado por `desktop/renderer-fixes.js`. Esa duplicación podía divergir y era innecesaria tras las correcciones recientes de autenticación y backend.

## Corrección
- Se eliminó el segundo fetch del parche Electron. El parche de escritorio ahora solo normaliza sintaxis AFC heredada y deja que `runProModel` sea la única ruta de ejecución.
- `runProModel` ahora:
  - normaliza sintaxis sencilla a lavaan cuando corresponde;
  - valida que exista base y sintaxis;
  - comprueba `/health` antes de estimar;
  - informa de forma visible el estado del motor;
  - aplica timeout de cinco minutos;
  - conserva el error real del backend;
  - permite comprobar/reintentar el motor después de una falla;
  - restaura el botón al finalizar, incluso ante errores.
- Al abrir Motor Pro se vuelve a comprobar el backend. Se añadió "Usar base del Centro de datos" y reutilización automática de la base importada cuando está disponible en memoria, sin persistir datos crudos.
- Se agregó un estado accesible `proRunStatus`.
- Versión de escritorio: `5.2.3-beta.1`.

## Validación automatizada
`tests/test_motorpro_recovery.py` verifica:
1. navegador → botón Motor Pro → Flask `/estimate` → R/lavaan → resultados de ajuste → descargas JSON;
2. comportamiento visible ante backend desconectado;
3. inyección del parche Electron real sin secuestrar la ruta principal;
4. conversión de sintaxis rápida `F1 = i01, i02, i03` a lavaan y ejecución real.

El flujo es `.github/workflows/motorpro-recovery.yml`.

## Criterios para Claude
Comparar esta rama contra `hotfix/v5-2-mahalanobis-mardia`. Revisar:
- que exista una sola solicitud `POST /estimate` por clic;
- que la base reutilizada sea la actual del Centro de datos y no una copia obsoleta;
- que el payload preserve estimador, tipo de dato, faltantes, bootstrap y ordinal_vars;
- que errores de lavaan, no convergencia y soluciones impropias permanezcan visibles;
- que Electron use el backend integrado en `127.0.0.1:8765` salvo configuración explícita;
- que JASP, Aiken, AFE y diagnósticos multivariados no sufran regresión;
- que el DMG y EXE nuevos se prueben en equipo real antes de fusionar/publicar.

No fusionar a main hasta completar revisión y prueba manual del instalador.
