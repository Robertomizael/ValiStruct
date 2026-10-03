# Known Issues — ValiStruct 5.4 Beta 1

## Limitaciones conocidas de distribución
- Los instaladores de Fase 6 continúan siendo Beta de validación interna hasta completar el cierre.
- macOS usa firma ad-hoc para pruebas internas; no equivale a Developer ID ni notarización.
- Windows no cuenta todavía con firma comercial de código.
- Fase 6 construye candidatos separados para macOS Apple Silicon (arm64) y macOS Intel (x64).
- Los artefactos de GitHub Actions expiran y no sustituyen un GitHub Release publicado.
- No se realizará merge a `main` ni publicación sin autorización explícita.

## Limitaciones metodológicas deliberadas
- Latencia es una regresión lineal OLS preliminar y no sustituye SEM ML/WLSMV.
- Motor Pro y módulos avanzados no constituyen validación clínica ni certificación metodológica automática.
- Proyectos previos al formato científico 5.4 pueden conservar resultados históricos incompatibles; ValiStruct los preserva pero exige recalcular/reestimar antes de generar nuevos informes.

## Seguridad y persistencia
- La autenticación institucional integrada continúa orientada a escenarios controlados; producción institucional debería preferir OIDC/SSO.
- Las sesiones institucionales en memoria se pierden al reiniciar el backend.
- El almacenamiento institucional basado en archivos JSON no sustituye una base de datos transaccional multiusuario.
- El backend desktop usa un token efímero local por sesión y restringe las rutas científicas.
