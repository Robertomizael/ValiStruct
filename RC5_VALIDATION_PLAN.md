# ValiStruct 3.0 RC5 — Plan de validación empírica

## Objetivo
Demostrar que los resultados científicos de ValiStruct coinciden con una implementación de referencia.

## Prueba automática incluida
`tests/statistical_validation.R`:
1. simula un CFA de dos factores;
2. ejecuta `backend/lavaan_engine.R`;
3. ajusta independientemente el mismo modelo con lavaan;
4. compara CFI, TLI, RMSEA, SRMR y, cuando existen, índices robustos;
5. exige diferencias numéricas ≤ 1e-8 dentro del mismo entorno.

## Validación cruzada recomendada
Ejecutar el fixture `tests/fixtures/cfa_two_factor_continuous.csv` en:
- ValiStruct Motor Pro;
- R/lavaan;
- jamovi/JASP;
- AMOS, cuando esté disponible.

Documentar:
- estimador;
- tratamiento de datos perdidos;
- estandarización;
- CFI/TLI/RMSEA/SRMR;
- cargas estandarizadas;
- covarianzas;
- convergencia y warnings.

## Criterio para avanzar a beta
- validación lavaan automática PASS;
- Docker smoke PASS;
- pytest backend PASS;
- Playwright PASS;
- sin hallazgos críticos abiertos;
- respaldo/restauración probados;
- prueba de carga documentada.
