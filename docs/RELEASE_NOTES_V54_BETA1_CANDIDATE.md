# ValiStruct 5.4 Beta 1 · Notas internas del candidato

**Estado:** candidato validado para revisión previa a publicación.  
**No publicado. No fusionado a `main`.**

## Cambios consolidados

- Integridad de importación y conservación de la base canónica.
- Persistencia de resultados de validez de contenido.
- Metadatos de versión y formato de proyecto 3.0 alineados.
- Delphi con bloqueo de configuración entre rondas.
- Conservación de etiquetas SAV/DTA.
- IC score de V de Aiken corregido y protegido por prueba numérica.
- Latencia identificada y validada como regresión lineal OLS preliminar.
- Token efímero para rutas científicas del backend desktop.
- Coherencia visible de ValiStruct 5.4 Beta.
- Beta gate ligado a la versión activa.
- Dependencias directas de Electron fijadas a versiones exactas.
- Instaladores autónomos macOS y Windows compilados satisfactoriamente.

## Artefactos validados

- macOS: `valistruct-desktop-macos-autonomous`
- Windows: `valistruct-desktop-windows-autonomous`

La procedencia, tamaños, artifact IDs y digests SHA-256 del ZIP se conservan en:

`release/candidate-v5.4-beta1.json`

## Limitaciones deliberadas

- Latencia no sustituye SEM de producción.
- No existe un `package-lock.json` transitivo generado en esta fase.
- El DMG usa firma ad-hoc para pruebas internas; no equivale a notarización comercial.
- No se ha publicado GitHub Release.
- No se ha realizado merge a `main`.
