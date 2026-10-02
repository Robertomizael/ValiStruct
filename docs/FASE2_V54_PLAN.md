# ValiStruct v5.4 · Fase 2 — Consolidación segura

**Rama:** `feature/v5-4-fase2-consolidacion-r2`  
**Base:** `backup/v5-3-fase1-cierre`  
**Objetivo:** consolidar el flujo de datos y reducir duplicidad operativa sin alterar el núcleo científico ni perder reversibilidad.

## Principio de trabajo
La rama antigua `feature/v5-4-fase2-consolidacion` queda como **referencia técnica únicamente**. No se fusiona porque diverge del cierre seguro de Fase 1 y no contiene todos sus fixes.

## Subfase 2A — Endurecimiento previo
Antes de consolidar datos:
1. comprobar la condición real del marcador desktop desde `desktop/main.js`;
2. hacer que el barrido de secciones falle rápido y señale la sección problemática;
3. comprobar navegación real con clic por acordeones visibles;
4. exigir estas pruebas en CI.

## Subfase 2B — Base central de participantes
Meta funcional:
- importar una base una sola vez;
- reutilizarla explícitamente en módulos científicos compatibles;
- mantener V de Aiken con base independiente de jueces;
- evitar copias obsoletas por módulo;
- preservar nombres y etiquetas de variables;
- mantener privacidad: datos crudos no se persisten en proyectos salvo consentimiento explícito;
- exportar resultados sin alterar el archivo fuente.

Destinos previstos para reutilización:
- Diagnósticos;
- Multivariado;
- Datos faltantes;
- AFE;
- AFC;
- Fiabilidad;
- Motor Pro;
- Latencia;
- módulos posteriores que consuman datos de participantes.

## Reglas científicas
- No modificar fórmulas, estimadores ni algoritmos en esta fase.
- AFE común sigue en R para métodos factoriales; ACP local puede mantenerse donde ya existe.
- AFC conserva WLSMV/DWLS para ordinales y ML para continuas según la implementación validada.
- V de Aiken conserva su base separada.
- No alterar projectFormat ni fixtures históricos sin migración explícita.

## Reglas de datos
- Fuente canónica en memoria para datos de participantes.
- Cualquier importación desde módulos debe registrar la misma base canónica.
- Cambio de base debe invalidar resúmenes/previews derivados obsoletos.
- SAV/DTA debe preservar etiquetas de variables cuando estén disponibles.
- Tokens estándar de ausencia (`NA`, `N/A`, `NULL`, `.`, vacío) deben tratarse de forma consistente.
- Persistencia de datos crudos en proyectos: solo con consentimiento explícito.

## Criterios de salida de Fase 2
- CI y RC verdes.
- Ninguna regresión científica.
- Una importación alimenta de forma reproducible todos los destinos compatibles.
- Proyectos históricos siguen abriendo.
- Privacidad por defecto conservada.
- Desktop macOS/Windows compila.
- Revisión independiente antes de crear `backup/v5-4-fase2-cierre`.

## Estado
- Subfase 2A — Endurecimiento previo: cerrada.
- Subfase 2B — Base central de participantes: cerrada.
- Subfase 2C — Validez de contenido: cerrada.
- Subfase 2D — Privacidad, SAV/DTA, proyectos históricos y builds desktop: cerrada.

### Criterios de salida de Fase 2
- [x] CI y RC verdes.
- [x] Ninguna regresión científica detectada por la suite vigente.
- [x] Una importación alimenta de forma reproducible los destinos compatibles.
- [x] Proyectos históricos siguen abriendo.
- [x] Privacidad por defecto conservada.
- [x] Desktop macOS y Windows compilan.
- [ ] Revisión independiente final del diff completo de Fase 2.
- [ ] Crear `backup/v5-4-fase2-cierre`.

No fusionar a `main` todavía.
