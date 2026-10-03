# ValiStruct v5.4 · Fase 5 — Candidate validation

**Rama:** `feature/v5-4-fase5-candidate-validation`  
**Base segura:** `backup/v5-4-fase4-cierre`

## Objetivo

Conservar evidencia verificable del candidato ValiStruct 5.4 Beta 1 sin publicar release, sin hacer merge a `main` y sin modificar ciencia.

## Alcance

- registrar procedencia exacta de los instaladores;
- registrar tamaño, artifact ID y SHA-256 del ZIP de GitHub Actions;
- comprobar que los artefactos provienen del commit de producción validado;
- comprobar que los commits posteriores al build no modifican producción;
- mantener `published=false` y `mergedToMain=false`;
- generar release notes internas, no una publicación.

## Fuera de alcance

- firma comercial/notarización;
- publicación en GitHub Releases;
- merge a `main`;
- incremento de versión;
- cambios estadísticos o metodológicos.

## Criterios de cierre

- manifiesto de candidato presente y coherente con `version.json`;
- dos artefactos registrados: macOS y Windows;
- SHA-256 con formato válido para ambos;
- build commit preservado;
- CI y RC verdes;
- backup de cierre de Fase 5.
