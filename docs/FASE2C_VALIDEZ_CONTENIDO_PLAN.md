# ValiStruct v5.4 · Subfase 2C — Validez de contenido

**Rama:** `feature/v5-4-fase2-consolidacion-r2`  
**Prerequisito:** Subfase 2B con CI/RC verdes.  
**Principio:** mantener completamente separadas la base de participantes y la base de jueces.

## Objetivo
Evolucionar el módulo actual de V de Aiken hacia un módulo general de **Validez de contenido**, preservando el cálculo existente y añadiendo métodos complementarios.

## Métodos previstos
- Delphi
- Delphi modificado
- I-CVI por ítem
- S-CVI/Ave por escala
- Kappa modificado
- V de Aiken
- CVR de Lawshe

## Arquitectura propuesta

### 1. Selector de método
Pantalla inicial de Validez de contenido con tarjetas o selector metodológico.

### 2. Base independiente de jueces
- Nunca reutilizar `ValiStructParticipantData`.
- Mantener matriz específica de jueces.
- Cada método declara su estructura de datos requerida.

### 3. Motor de orientación
Ayuda no prescriptiva para elegir método según propósito:
- consenso iterativo → Delphi;
- consenso con ronda/estructura inicial modificada → Delphi modificado;
- relevancia por ítem → I-CVI;
- evidencia a nivel escala → S-CVI/Ave;
- corrección por acuerdo esperado al azar → Kappa modificado;
- puntuaciones ordinales de jueces → V de Aiken;
- esencialidad del ítem → CVR de Lawshe.

### 4. Salidas homogéneas
Cada método deberá proporcionar:
- resultado por ítem cuando corresponda;
- resultado global/escala cuando corresponda;
- interpretación metodológica;
- advertencias y supuestos;
- exportación CSV;
- informe HTML/APA;
- registro de decisiones del investigador.

## Blindajes
- V de Aiken actual debe conservar golden master/regresión.
- No modificar fórmulas de Aiken al añadir nuevos métodos.
- Los nuevos métodos se incorporarán uno por uno con pruebas unitarias y E2E.
- No mezclar datos de jueces con participantes.
- No inventar puntos de corte universales; los umbrales deben ser configurables o claramente referenciados.

## Orden de implementación
1. Renombrado/encapsulado visual: V de Aiken → Validez de contenido.
2. Selector metodológico sin alterar cálculo.
3. I-CVI + S-CVI/Ave.
4. Kappa modificado.
5. CVR de Lawshe.
6. Delphi y Delphi modificado como flujo de consenso/documentación.
7. Informe integrado y comparación metodológica.
8. Revisión científica final y cierre.

## Estado
Plan preparado. No implementar hasta confirmar Subfase 2B verde.
