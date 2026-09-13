# Known Issues — 3.0 RC3

- La autenticación integrada sigue siendo apropiada solo para beta controlada; producción debe preferir OIDC/SSO.
- Las sesiones/token están en memoria y se pierden al reiniciar el backend.
- El almacenamiento institucional basado en archivos JSON no sustituye una base de datos transaccional multiusuario.
- La suite completa `pytest` requiere dependencias del backend instaladas.
- Las pruebas E2E con Playwright requieren navegador Chromium instalado.
- Deben ejecutarse pruebas reales de R/lavaan en un entorno con R y paquetes configurados.
- El Motor Pro y módulos avanzados no deben considerarse validados clínicamente ni certificados.
