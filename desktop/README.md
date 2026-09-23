# ValiStruct Desktop Beta

Esta carpeta contiene la primera base de empaquetado de escritorio para ValiStruct usando Electron y electron-builder.

## Objetivo

Generar instaladores nativos de prueba para:

- Windows: instalador NSIS `.exe`
- macOS: imagen `.dmg`

## Estado actual

La envoltura de escritorio ya incluye el frontend y copia el backend al paquete. En esta primera fase, el equipo donde se ejecute la aplicación todavía debe tener instalados:

- Python 3
- R con `Rscript` disponible en PATH
- dependencias Python de `backend/requirements.txt`
- paquetes R requeridos por ValiStruct

La siguiente fase del proyecto Desktop integrará runtimes portables de Python y R para lograr una instalación de un solo paso.

## Desarrollo local

```bash
cd desktop
npm install
npm start
```

## Construcción

Windows:

```bash
npm run dist:win
```

macOS:

```bash
npm run dist:mac
```

Los artefactos se generan en `desktop/dist/`.

## Seguridad

Electron se ejecuta con `contextIsolation`, sin `nodeIntegration` en el renderer y con un preload mínimo. El backend se inicia en modo local con autenticación institucional desactivada para esta fase de pruebas.

## Firma

Los primeros instaladores serán artefactos Beta sin firma. Para distribución pública posterior se deberán añadir:

- firma de código de Windows;
- Developer ID y notarización de Apple para macOS.
