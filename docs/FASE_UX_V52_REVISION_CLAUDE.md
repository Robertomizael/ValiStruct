# ValiStruct v5.2 · Rediseño UX y validación externa — revisión para Claude
**Dr. Roberto Joel Tirado Reyes** · Autor conceptual y director científico
**Estado:** versión beta visual sobre `feature/v5-1-fase1-diseno-datamanager`. No fusionar ni desplegar sin validación.

## Corrección del problema mostrado por el director
La v5.1 mantuvo la portada heredada con demasiadas tarjetas, una barra izquierda larga y solo un aviso de «Etapa II en construcción». La v5.2 hace lo siguiente:
- Menú lateral científico con cinco grupos en acordeón (Centro de datos, Validación interna, Validación externa, Resultados/reportes, Proyectos) más Motor Pro destacado y herramientas heredadas colapsadas.
- Un único módulo visible en el workspace al seleccionar una opción. La barra lateral es la fuente de navegación.
- Nueva portada de baja densidad: dos acciones principales y cuatro accesos rápidos, sin catálogo de módulos.
- Tres secciones propias y accesibles desde el menú izquierdo: estabilidad/concordancia, validez de criterio, rendimiento/baremación, cada una con controles de preparación y ayuda contextual.
- Marca visible del director científico. Se preservan los botones originales, sus IDs y manejadores, Aiken y el importador JASP.
- Hoja de estilos aislada `v52.css` y script `v52-shell.js` previos a `app.js`, para que sus nuevos paneles entren en el registro original de navegación.
- Empaquetado Electron/PWA con v5.2 y assets nuevos. Desktop no reinyecta el shell anterior cuando detecta `data-v51-grouped=yes`.

## ESTADO CIENTÍFICO: distinción crítica
Los tres espacios de validación externa **ya son pantallas funcionales de configuración y navegación**, pero **sus cálculos todavía NO están implementados**. No se simulan coeficientes ni valores de p. Las funciones CCI, kappa, regresiones, ROC/Youden y baremos requerirán motor R, pruebas de equivalencia e informes reproducibles. No se debe anunciar "validación externa estadística terminada".
Los controles de preparación se guardan solo durante la sesión, no almacenan datos clínicos. La carga de bases adicionales con cruce por ID también es una fase pendiente. En pantalla se indica explícitamente.

## Criterios obligatorios de aceptación
1. Abrir app en Chromium: ningún `pageerror`, nueva portada visible sin tarjetas antiguas, sidebar con los tres módulos externos y Motor Pro.
2. Cambiar de módulo: solo un `.panel.visible` y los acordeones se abren a demanda.
3. Cada módulo externo puede elegir procedimiento y documentar variables; los análisis no ejecutados se presentan como pendientes, sin resultados inventados.
4. Una base común cargada en Centro de datos es reconocida en las pantallas externas, sin mezclarla con la matriz de jueces de Aiken.
5. Conservar tests del hotfix de privacidad, importador JASP, frontend estático y tests nuevos de UX.
6. La app desktop debe empaquetar todos los assets nuevos, respetar la navegación v5.2 y generar instaladores en una ejecución NUEVA de GitHub Actions. Los DMG de v5.1 son anteriores y no representan esta versión.

## Revisión de Claude
Comparar la rama v5.2 contra v5.1; auditar teclado/lector de pantalla, estilo adaptable en pantallas pequeñas, flujo por acordeón, integridad de datos, seguridad y salidas; reportar cualquier regresión con prueba reproducible. No publicar ni fusionar.
