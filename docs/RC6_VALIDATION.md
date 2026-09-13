# ValiStruct 3.0 RC6 — Validación automatizada

RC6 no incorpora nuevas funciones científicas. Convierte las pruebas pendientes en un proceso reproducible.

## Niveles de validación

1. **Estática**
   - sintaxis Python y JavaScript;
   - globals del backend;
   - navegación y DOM;
   - integridad de archivos críticos.

2. **Estadística**
   - CFA continuo con MLR;
   - CFA ordinal con WLSMV;
   - comparación de ValiStruct contra una ejecución independiente de lavaan;
   - comparación de índices de ajuste y cargas estandarizadas.

3. **Backend**
   - pytest;
   - smoke endpoints;
   - restauración/path traversal;
   - autenticación y rutas institucionales según tests disponibles.

4. **Navegador**
   - Playwright/Chromium.

5. **Beta gate**
   - `tests/beta_gate.py` bloquea la promoción si una prueba obligatoria falla o no ha sido ejecutada.

## CI
Se incluye `.github/workflows/rc6-validation.yml` para ejecutar las pruebas con R, lavaan, Python y Chromium en un entorno reproducible.

## Importante
El hecho de incluir el workflow no equivale a haberlo ejecutado. La promoción a Beta 1 requiere un run real en verde.
