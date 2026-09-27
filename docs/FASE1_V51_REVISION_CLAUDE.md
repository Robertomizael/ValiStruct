# ValiStruct v5.1 · Fase 1 · Diseño y construcción inicial
**Director científico:** Dr. Roberto Joel Tirado Reyes · Autor conceptual y director científico
**Estado:** Rama de desarrollo; NO desplegar, NO fusionar con main hasta revisión y pruebas completas.
**Base:** hotfix/v5-1-desbloqueo-privacidad, commit f1cfe19b8bc7ee8b821443d314de0ed0e714e9c8.

## Alcance implementado
1. Navegación reagrupada visualmente en Etapa I, Etapa II (indicada como próxima), Datos/Resultados, Motor Pro y herramientas avanzadas. Las secciones antiguas no se borran; se reutilizan los mismos nodos y manejadores. No declarar Etapa II operativa hasta crear sus motores y pruebas.
2. Centro unificado de participantes en memoria mediante participant-data.js, sin modificar V de Aiken ni su matriz de jueces.
3. Un CSV/XLSX convertido alimenta Diagnóstico, Fiabilidad, ACP/AFE local, AFC local y Motor Pro. Importador JASP permanece intacto.
4. Selección explícita de ítems. En ausencia de selección se detectan columnas numéricas excepto ID/folio en primera columna. El investigador debe excluir covariables y confirmar la selección.
5. Filtrado por casos completos **solo de los ítems seleccionados**, con conteo visible de exclusiones. Fiabilidad por dimensión usará **la misma muestra completa global**, decisión ya aprobada por el director, cuando se implemente en la fase siguiente.
6. Cambio de datos invalida los resultados de participantes de la sesión. Los de jueces/Aiken se conservan.
7. Estilo lateral azul y crédito oficial: Autor conceptual y director científico.
8. Service Worker con caché nueva y empaquetado desktop actualizado para cargar los dos scripts nuevos. Instaladores aún no probados.

## Límites y decisiones que NO deben tergiversarse
- **Aiken:** continúa protegido. La corrección del IC de Penfield–Giacobbi será solo para proyectos *nuevos*. Los históricos deben conservar resultado + aviso. Esta fase no cambia ni recalcula IC. Todavía falta almacenar configuración y matriz de jueces en proyectos nuevos.
- **Datos:** importación CSV local / XLSX y SAV/DTA mediante backend existente. No hay soporte nuevo de etiquetas/valores perdidos de SPSS en el DataManager inicial; las transformaciones avanzadas son fases posteriores.
- **AFE:** ACP local sigue siendo prototipo. Extracción por factores comunes con psych::fa en R se implementará en fase posterior, no se debe anunciar como terminada. Factorización de imágenes permanece pendiente de motor validado.
- **AFC:** selección de estimador con recomendación/confirmación WLSMV pendiente; Motor Pro sin sustituciones nuevas en esta fase.
- **Omega, fiabilidad dimensional, estabilidad, criterio, ROC, Youden, baremación y semáforo:** pendientes de fases estadístico-metodológicas y sus suites de equivalencia con R.
- **Privacidad:** mantener protección de proyectos por defecto del hotfix. No utilizar bases de pacientes reales en pruebas.
- **Informes:** el adaptador de resultados de fiabilidad se incorporó en hotfix; comprobar siempre reportes/exportaciones. Evitar rotular valores no calculados como omega preliminar.
- **Publicación:** ni merge ni instalador hasta auditoría y aprobación.

## Pruebas obligatorias antes de revisión de Claude
- Node --check de app.js, navigation-v51.js, participant-data.js y suite del importador JASP.
- tests/static_frontend_audit.py y Playwright tests/test_hotfix_startup_privacy.py.
- tests/test_v51_stage1.py: navegación conservadora, un único dataset con exclusiones, envíos a 3 módulos, juez Aiken independiente, invalidación y encabezados duplicados.
- RC validation completa y, más adelante, R/lavaan + Electron + PWA offline reales.

## Solicitud a Claude
Auditar este diff contra la rama base hotfix, confirmar que no se han perdido funciones ni roto la importación JASP; ejecutar los tests nuevos, buscar fallos de carga de módulos tardíos, comprobar privacidad en importaciones y reportar incidencias H-13+ con casos de reproducción. No fusionar main.
