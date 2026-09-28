# ValiStruct v5.2.3 Beta · Restauración de Motor Pro R/lavaan
**Autor conceptual y director científico:** Dr. Roberto Joel Tirado Reyes
**Ámbito:** corrección sobre `hotfix/v5-2-mahalanobis-mardia`. No fusionar con main ni publicar como edición definitiva sin revisión y comprobación del instalador.

## Incidencia
La versión Desktop mostraba sintaxis lavaan de cinco factores, pero el botón de Motor Pro no daba una estimación verificable. El análisis del código reveló varias causas posibles y regresiones concretas:
1. `desktop/renderer-fixes.js` capturaba el clic, llamaba `stopImmediatePropagation()` y sustituía el manejador original de `app.js`. Esto duplicaba el flujo de Motor Pro y podía dejar errores/estado inconsistentes.
2. El campo bootstrap tenía **1,000 por defecto** incluso con estimador MLR, una combinación que requiere validación expresa y podía imponer cómputo innecesario o incompatible.
3. `waitForBackend()` en Electron trataba respuestas HTTP menores de 500 como disponibles. Un **503 de /health**, correspondiente a R/lavaan no preparado, podía pasar por servicio listo.
4. `localStorage.valistruct_api_base` podía conservar una dirección remota obsoleta entre versiones del DMG, aun cuando Desktop usa un backend local.
5. El módulo profesional exigía importar un CSV independiente aun cuando la sesión ya tenía participantes o una matriz multivariada. No existía flujo claro para reutilizar la misma base.

## Cambios implementados
- **Un solo manejador Motor Pro:** el parche de Electron únicamente convierte sintaxis AFC abreviada a lavaan y delega al manejador original de app.js. Se conserva el diagrama de rutas de publicación posterior al cálculo.
- **Arranque sano:** Electron espera respuesta `200` y JSON `ok: true` de /health, no solo un socket abierto. Informa error del motor.
- **URL inequívoca:** las vistas `file://` en Desktop usan `http://127.0.0.1:8765`; no reutilizan endpoints obsoletos almacenados. Las vistas web conservan la posibilidad de configurar un servidor externo.
- **Bootstrap 0 por defecto:** el usuario debe elegir réplicas expresamente; esta versión permite bootstrap clásico con ML y rechaza con mensaje claro la combinación con MLR/WLSMV cuando se solicita bootstrap.
- **Datos reutilizables:** nuevos botones en Motor Pro para reutilizar la base central de participantes o la base del diagnóstico multivariado. El investigador comprueba la procedencia antes de ejecutar. Exporta CSV correctamente delimitado y conserva nombres de ítems.
- **Mensajes visibles:** conexión, faltantes, parámetros, sintaxis y errores del backend se muestran en el panel; no deja el botón permanentemente inactivo.
- **Runtime fresco v3** en Desktop para impedir que una instalación anterior conserve un entorno R obsoleto. Paquetes integrados comprobados en arranque.
- **Versión instalada:** 5.2.3-beta.1 con cache PWA actualizado.

## Comprobaciones exigidas
`.github/workflows/motorpro-recovery.yml` ejecuta Python/Playwright con backend real Flask + R/lavaan: salud real de R, modelo de seis ítems/2 factores, modelo de 350×28/5 factores con MLR, transferencia de datos previos, informe JSON, conversión del parche Desktop, mensajes de error y reproducción de la vista file:// con dirección obsoleta en localStorage. Se conservan pruebas estáticas y JASP; suite RC independiente.
`.github/workflows/desktop-build.yml` produce DMG y EXE beta. La compilación no equivale por sí sola a una prueba funcional en el Mac del usuario.

## Auditoría solicitada a Claude
Revisar diff contra `hotfix/v5-2-mahalanobis-mardia`, confirmación de un solo POST /estimate por clic, opciones lavaan con MLR/ML/WLSMV, consistencia bootstrap/estimador, tratamiento de casos faltantes, validación de variables de la sintaxis, conexión segura localhost desde Desktop y web, integridad del backend R integrado y revisión de permisos. Ejecutar en Mac y Windows, verificar cinco factores y 28 ítems sin reutilizar un CSV de otra investigación. No alterar V de Aiken ni el importador JASP. No fusionar sin consenso.
