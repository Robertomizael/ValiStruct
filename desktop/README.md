# ValiStruct Desktop 5.4 Beta

El paquete Desktop es autónomo: los workflows integran un runtime local de Python y R dentro del instalador. El usuario final no debe instalar Python, R ni paquetes estadísticos por separado.

## Plataformas del candidato interno

- Windows: instalador NSIS `.exe`.
- macOS Apple Silicon: imagen `.dmg` arm64.
- macOS Intel: imagen `.dmg` x64 construida y probada en runner `macos-15-intel`.

## Desarrollo local

```bash
cd desktop
npm ci
npm start
```

## Construcción reproducible

Las dependencias de Electron están fijadas y Fase 6 incorpora `package-lock.json`. Los workflows usan `npm ci` con Node 22.12. El cierre de seguridad usa `npm audit` y bloquea hallazgos altos/críticos; el audit completo del lockfile de Fase 6 quedó verde tras actualizar `tar`, SheetJS, Electron, electron-builder y `@electron/get`.

El runtime científico también se fija en Fase 6 a versiones concretas de Python, R, lavaan, psych, naniar y dependencias Python. Los instaladores deben reconstruirse después de cualquier cambio de estas versiones.

## Seguridad desktop

- `contextIsolation: true`.
- `nodeIntegration: false`.
- sandbox del renderer activo.
- token científico efímero por sesión.
- backend local reutilizado durante toda la sesión de Electron.
- datos locales de proyectos en `app.getPath('userData')`.
- navegación HTTP/HTTPS fuera de Electron; se abre en el navegador del sistema.

## Firma y distribución

El DMG de validación interna usa firma ad-hoc. Windows aún no usa certificado comercial. Antes de una distribución pública se requieren, como mínimo:

- Developer ID + hardened runtime + notarización Apple;
- firma Authenticode para Windows;
- prueba manual en equipos limpios;
- publicación de los binarios validados como assets de un Release con SHA-256.

Los artefactos de GitHub Actions son evidencia de CI y no sustituyen una publicación formal.
