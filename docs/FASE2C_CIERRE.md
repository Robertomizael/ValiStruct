# ValiStruct v5.4 · Cierre técnico Subfase 2C — Validez de contenido

**Rama:** `feature/v5-4-fase2-consolidacion-r2`  
**Base de referencia:** `ac49128`  
**Estado:** cierre técnico pendiente únicamente de CI/RC final del informe integrado.

## Métodos disponibles
1. Delphi
2. Delphi modificado
3. I-CVI por ítem
4. S-CVI/Ave por escala
5. Kappa modificado
6. V de Aiken
7. CVR de Lawshe

## Principios de diseño
- Base de jueces separada de la base de participantes.
- V de Aiken conserva sus controles y motor existentes.
- No se combinan coeficientes heterogéneos en un puntaje único.
- Los criterios interpretativos configurables se presentan como criterios de trabajo, no como universales.
- Delphi se implementa como proceso iterativo con trazabilidad de rondas, no como coeficiente único.

## Implementaciones

### I-CVI / S-CVI-Ave
- Matriz de jueces específica.
- Dicotomización según umbral de relevancia configurable.
- I-CVI por ítem.
- S-CVI/Ave como promedio de I-CVI.
- Exportación CSV.

### Kappa modificado
- Reutiliza la misma matriz de relevancia de CVI.
- Pc por ítem.
- Kappa modificado por ítem.
- Promedio descriptivo.
- Sin categorías universales automáticas.

### CVR de Lawshe
- Clasificación: esencial / útil pero no esencial / no necesario.
- CVR por ítem.
- Criterio interpretativo configurable.
- Exportación CSV.

### Delphi / Delphi modificado
- Número de expertos e ítems configurable.
- Escala configurable.
- Valor favorable configurable.
- Acuerdo requerido configurable.
- IQR máximo configurable.
- Múltiples rondas.
- Mediana, Q1, Q3, IQR y porcentaje de acuerdo por ítem.
- Delta de acuerdo respecto a ronda previa.
- Registro de retroalimentación/decisiones.
- Exportación de trazabilidad CSV.

### Informe integrado
- Resume únicamente los métodos ya calculados.
- Mantiene cada coeficiente/metodología separado.
- No construye un puntaje global combinado.
- Exportación HTML.

## Regresiones específicas
- `test_fase2c_content_validity_shell.py`
- `test_fase2c_cvi.py`
- `test_fase2c_modified_kappa.py`
- `test_fase2c_lawshe.py`
- `test_fase2c_delphi.py`
- `test_fase2c_integrated_report.py`

## Auditoría del diff
Comparación inicial:
`ac49128...38cb792`

Resultado:
- 25 commits por delante;
- 0 commits por detrás;
- cambios concentrados en `app.js`, `index.html`, `v52-shell.js`, CI y pruebas de 2C;
- sin cambios en backend científico, scripts R, AFE/AFC, fiabilidad o Motor Pro.

## Criterios para cierre definitivo
- [x] 7 métodos disponibles.
- [x] Aiken preservado como motor independiente.
- [x] CVI/Kappa con prueba numérica controlada.
- [x] Lawshe con prueba numérica controlada.
- [x] Delphi con prueba E2E de rondas y trazabilidad.
- [x] Informe integrado sin mezcla de coeficientes.
- [ ] CI unificado final verde.
- [ ] RC final verde.
- [ ] Crear respaldo `backup/v5-4-fase2c-cierre`.

## Restricción
No fusionar a `main` todavía.
