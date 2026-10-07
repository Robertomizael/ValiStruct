# PATH v2 — Diagrama del AFC estilo AMOS con rotación tipo JASP

Rama: `feature/v5-4-fase3-hardening` · base auditada: `6e78c3a`

## Arquitectura (`path-v2.js`, módulo único compartido web/escritorio)

| Capa | Función | Responsabilidad |
|---|---|---|
| Adapter | `fromLavaan`, `fromQuickCfa` | Convierte resultados en un modelo normalizado e inmutable: `factors`, `indicators`, `loadings`, `factorVariances`, `factorCovariances`, `residualVariances`, `residualCovariances`, `undrawn`. Cada parámetro conserva `est`, `se`, `z`, `pvalue`, `std_all`. |
| Layout | `layout`, `assignLanes` | Solo geometría: orientación (LR/TB/RL/BT), espejo, carriles de covarianza, posiciones manuales. No lee estimaciones. |
| Renderer | `render` | Produce una lista de primitivas (elipse, rectángulo, trazo, texto) y la caja envolvente con todos los elementos. |
| Exporter | `toSvg`, `toPdf`, `pngBlob` | SVG autocontenido, PDF vectorial sin dependencias y PNG a 3×. |
| Controls | `mount` | Panel, orientación, zoom/pan, arrastre de nodos, exportación. |

`install()` envuelve `renderCfaResults` y `renderProResults`. Si PATH v2 falla, el diagrama anterior permanece (fallback); solo se retira tras un montaje correcto.

## Reglas científicas

- R² = 1 − θ estandarizada (`std_all` de `item ~~ item`). Se eliminó R² = λ² como regla general.
- R² solo se recorta a [0, 1] dentro de una tolerancia de 1e-6; fuera de ella se muestra el valor real con aviso.
- Sin `std_all` no se muestra R² ni se ofrece la vista estandarizada. Nunca se rotula `est` como estandarizada.
- AFC rápido: "No estandarizadas" y "Significancia" quedan deshabilitadas porque esa fuente no las contiene.
- Las covarianzas residuales se dibujan por defecto; si el usuario oculta parámetros del modelo, aparece un aviso en la interfaz y en la nota del diagrama.
- Regresiones (`~`) y cargas de orden superior no se dibujan en este diagrama de medición: se declaran en el aviso, no se omiten en silencio.
- No se modificó `backend/`, `app.js`, la sintaxis ni ningún estimador.

## Pruebas

- `node --test tests/test_path_v2.cjs` — 13 pruebas (adaptador, R², etiquetado, inmutabilidad, recortes, solapamientos, carriles, exportación).
- `pytest tests/test_path_v2_browser.py` — 30 pruebas (integración, regresión estadística en 6 modelos, recortes en 16 combinaciones, zoom/pan/arrastre, exportación SVG/PNG/PDF, protección frente a `desktop/preload.js`, fallback).
- Fixtures sintéticos en `tests/fixtures/path_v2/` (forma de Motor Pro; no son resultados reales).

## Limitaciones y pendientes

- La comparación contra R/lavaan real (χ², CFI, etc.) corre en CI; el entorno de desarrollo no tenía R.
- No se probó dentro de Electron empaquetado; la protección frente a `preload.js` y `renderer-fixes.js` se verificó en navegador.
- Las posiciones manuales (arrastre) viven en la sesión y se exportan, pero no se guardan en el proyecto.
- Etiquetas de carga: número sin prefijo (estilo AMOS); el tipo de estimación se declara en la nota del diagrama.
- El zoom con rueda requiere Ctrl/⌘ para no secuestrar el desplazamiento de la página.
- Los renderers anteriores (`renderCfaDiagram`, `buildPathDiagram`) siguen en el código como fallback.
