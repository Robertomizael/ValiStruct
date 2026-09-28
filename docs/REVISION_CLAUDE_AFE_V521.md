# ValiStruct v5.2.1 · Corrección inmediata de AFE
**Solicitante y director científico:** Dr. Roberto Joel Tirado Reyes · Autor conceptual y director científico.
**Rama:** fix/v5-2-afe-estadistica-exportaciones. NO fusionar ni publicar sin validación.

## Defecto reportado y causa
La v5.2 heredó de v5.1 el desplegable AFE con una única opción ACP. KMO y Bartlett existían, pero solo dentro de la ejecución de ACP; Mardia estaba en Motor Pro y no podía invocarse desde AFE. Los botones de cálculo y descarga permanecían después de un formulario grande, ocultos hasta importar y difíciles de localizar. El rediseño UX no fue acompañado por la implementación estadística comprometida.

## Correcciones de esta rama
- Botonera **siempre visible, situada encima de la importación y configuración**: Diagnósticos KMO/Bartlett/Mardia; Ejecutar extracción; resultados CSV; informe HTML; impresión/PDF y sintaxis R.
- Selector: ACP local, ULS/MINRES, GLS, ML, PAF y factorización alfa con motor R/psych real. Factorización de imágenes sigue desactivada **por falta de motor contrastado**. Ninguna opción simula resultados ACP bajo otra etiqueta.
- Diagnósticos independientes de extracción en POST /efa; el motor nuevo backend/efa_engine.R calcula KMO y MSA, Bartlett con distribución chi-cuadrado y Mardia (asimetría/cutrosis) en casos continuos completos. Si no hay R, KMO/Bartlett conservan cálculo local y se informa que Mardia no está disponible.
- Para factores comunes, se entrega patrón de cargas, estructura, correlaciones de factores, comunalidades, ajuste, autovalores y análisis paralelo reproducible con semilla fija.
- Los casos completos se definen sobre los ítems seleccionados y se informan exclusiones. La interpretación de Mardia no debe dirigir la elección de WLSMV para ítems ordinales.
- Actualización de PWA y Electron; versión beta 5.2.1. V de Aiken y el importador JASP **no se alteran**.

## Validación exigida
`tests/test_efa_engine_r.py`: diagnóstico y 5 métodos contra ejecución auténtica de psych; `tests/test_efa_v52_browser.py`: botones, selección, exportación y error ante R caído; pruebas heredadas Playwright y JASP; `.github/workflows/efa-r-validation.yml`; RC general.

## Auditoría Claude
Revise diferencias contra feature/v5-2-ux-validacion-externa, seguridad del endpoint POST /efa, reproducción R de ULS/GLS/ML/PAF/alpha, dimensiones de salida para rotaciones ortogonales y oblicuas y equivalencia numérica de KMO/Bartlett/Mardia. Revise la accesibilidad del toolbar y exportaciones en Electron macOS/Windows. Informe hallazgos pendientes y pruebas necesarias antes de autorizar la integración.
