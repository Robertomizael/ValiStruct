# ValiStruct v3.0.1 — revisión de la propuesta

Esta rama integra las mejoras metodológicas propuestas para el motor estadístico, con ajustes conservadores para preservar la versión principal hasta completar las pruebas de R.

## Cambios integrados
- Se excluyen identificadores numéricos cuyo encabezado sea ID, folio, participante, sujeto o caso.
- En WLSMV se reconocen como ordinales los indicadores observados presentes en la sintaxis, no las variables de grupo, identificadores o covariables.
- El motor CFA/SEM admite una rotación solicitada para modelos ESEM definidos mediante bloques `efa()` y devuelve correlaciones latentes.
- En invariancia ordinal se aplican restricciones a umbrales en vez de interceptos; se utiliza parametrización theta en modelos multigrupo y se incorporan TLI, Δχ² y sus grados de libertad.
- El módulo de calidad muestra √AVE, correlación latente máxima y contraste de Fornell–Larcker, además de CR/AVE/HTMT.
- La interfaz distingue el ajuste estándar del escalado o robusto para indicadores ordinales.

## Limitaciones y validación
La invariancia ordinal exige verificar identificación, convergencia y compatibilidad del estimador para cada comparación. Los índices orientativos no validan por sí solos una escala. La prueba χ² escalada puede ser sensible al tamaño muestral.

Se añadieron pruebas automatizadas con datos sintéticos reproducibles. En entornos sin Rscript se omiten expresamente; el flujo de GitHub Actions instala R, lavaan, jsonlite y psych y las ejecuta en cada propuesta de integración. **No publicar como versión estable hasta revisar la ejecución real de esas pruebas.**

GitHub Pages solo sirve el frontend: las operaciones lavaan requieren el backend R publicado y configurado por separado.
