# ValiStruct v5.4 · Fase 3 — Endurecimiento posterior a Fase 2

**Rama:** `feature/v5-4-fase3-hardening`  
**Base segura:** `backup/v5-4-fase2-cierre`  
**Principio:** cambios pequeños, reversibles y protegidos por regresión. No fusionar a `main` ni publicar sin autorización explícita.

## Subfase 3A — Integridad y rutas de datos
1. H-B: validar importaciones directas de Fiabilidad, AFE y AFC antes de sustituir la base canónica.
2. H-C: unificar las dos rutas de reutilización de datos hacia Motor Pro.
3. Pruebas E2E de no destrucción de la base válida ante archivos rechazados.

## Subfase 3B — Persistencia y versión
1. H-D: decidir y documentar la persistencia de resultados de I-CVI, Kappa modificado, Lawshe y Delphi.
2. H-E: actualizar versión visible, metadatos de proyecto y caché PWA antes de publicación.
3. Mantener compatibilidad con proyectos históricos.

## Subfase 3C — Límites y metadatos
1. H-F: fortalecer o simplificar la prueba del marcador desktop al retirar dependencias antiguas.
2. H-G: documentar/gestionar cambios de panel entre rondas Delphi.
3. H-H: evaluar etiquetas de valor SAV/DTA y su uso en salidas.

## Subfase 3D — Pendientes científicos y seguridad
Cambios científicos separados y con auditoría específica:
- IC de V de Aiken;
- salida OLS de Latencia y reporte APA;
- token por sesión para rutas científicas locales en escritorio.

## Regla de oro
Ningún cambio científico se mezcla con refactorización, versión, caché o navegación.
