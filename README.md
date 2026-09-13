# Despliegue institucional de ValiStruct 2.0

## Backend
Se incluye un Dockerfile que instala:
- Python
- R
- lavaan
- semTools
- psych
- naniar
- Flask
- dependencias de exportación

## Inicio
Desde la carpeta `deployment`:

```bash
docker compose up --build
```

El backend queda disponible en:
`http://localhost:8765`

Para iPhone/iPad o uso institucional se recomienda:
1. desplegar el backend en un servidor HTTPS;
2. configurar la URL en `Dispositivo / PWA`;
3. servir el frontend también mediante HTTPS.

## Producción
Antes de uso institucional se recomienda:
- proxy inverso HTTPS;
- autenticación si se manejan datos sensibles;
- límites de carga;
- registro de errores;
- copias de seguridad;
- política institucional de privacidad.


## ValiStruct 2.3 · Modo institucional opcional

Funciones desactivadas por defecto:
- autenticación,
- biblioteca institucional de proyectos.

Para activarlas configure las variables del archivo `.env.example`.

Roles disponibles:
- `student`: lectura/aprendizaje;
- `researcher`: puede crear y actualizar sus proyectos;
- `teacher`: puede crear y actualizar sus proyectos;
- `admin`: acceso administrativo a todos los proyectos.

La implementación incluida es un prototipo de despliegue controlado. Para producción pública se recomienda integrar SSO/OIDC/SAML institucional en lugar de mantener credenciales directamente en variables de entorno.
