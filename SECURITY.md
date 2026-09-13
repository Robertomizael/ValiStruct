# Seguridad y privacidad — ValiStruct 2.1

Para despliegue institucional:

- Use HTTPS en frontend y backend.
- Limite CORS a dominios institucionales.
- No registre datos crudos en logs.
- Mantenga procesamiento transitorio cuando sea posible.
- Configure límite de tamaño de archivos.
- Agregue autenticación institucional si se procesan datos no públicos.
- No almacene datos clínicos identificables sin base jurídica, controles de acceso y política de retención.
- Mantenga R, Python y paquetes actualizados.
- Ejecute el backend con un usuario no privilegiado.
- Añada rate limiting y monitoreo antes de exposición pública.

La configuración por defecto de la interfaz evita incluir datos crudos en archivos de proyecto.


## ValiStruct 2.2
- Los archivos SAV/DTA se procesan en archivos temporales y se eliminan después de la conversión.
- El cifrado de proyectos se realiza en el navegador mediante AES-GCM y PBKDF2-SHA256.
- La contraseña de cifrado no se almacena ni se envía al backend.
- Para producción, limite CORS y agregue autenticación institucional antes de procesar datos no públicos.


## Autenticación v2.3
La autenticación integrada es opcional y está pensada para pruebas o despliegues pequeños/controlados.
Para un entorno institucional real:
- preferir SSO/OIDC/SAML;
- usar almacenamiento persistente seguro para sesiones;
- rotar secretos;
- no usar contraseñas en texto claro;
- mantener la biblioteca institucional detrás de HTTPS y control de acceso;
- realizar copias de seguridad cifradas.


## Colaboración v2.4
- Conceda permisos mínimos necesarios.
- Use `viewer` cuando no se requiera edición.
- Antes de restaurar una versión, ValiStruct crea un respaldo automático.
- Para despliegue real, persista permisos y sesiones en una base de datos segura.


## Beta colaborativa v2.5
- La sincronización usa una revisión numérica para detectar conflictos.
- No resuelva conflictos de edición sobrescribiendo automáticamente.
- La bitácora de actividad debe tratarse como dato institucional.
- Las notificaciones no deben contener información sensible.
- Antes de beta, configure copias de seguridad y retención.


## Telemetría v2.6
- Desactivada por defecto.
- Solo admite una lista cerrada de eventos técnicos.
- No enviar payloads de proyectos, sintaxis, resultados, comentarios ni datos crudos.


## Auditoría y aprobaciones v2.7
- La huella SHA-256 es una marca de integridad interna, no una firma electrónica avanzada o cualificada.
- No presentar las aprobaciones internas como firma legal.
- Proteja los paquetes de auditoría porque pueden incluir metadatos de colaboración.
