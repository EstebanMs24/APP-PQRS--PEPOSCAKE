# Validación — acceso interno, 31 de octubre de 2026

## Pruebas locales completadas

- Sintaxis y enlaces internos; siete pruebas unitarias de acceso, endpoints retirados, filtros, fechas y evidencias.
- PostgreSQL PGlite: creación/edición administrativa, historial transaccional, versiones obsoletas, archivo/restauración, secuencia superior a 99999 y resumen superior a 1000 registros.
- Lector: lee casos, historial, evidencias y resumen. Se rechazan creación, modificación, borrado, cambios de rol y RPC de actualización. Anónimo sin acceso.
- Playwright: login/logout, formularios, edición, estados, archivo/restauración, filtros, exportaciones, lectores sin controles de escritura ni acceso a páginas administrativas; seis pantallas móviles.
- Snapshot privado de datos y metadatos de la aplicación restaurado en PostgreSQL local; migraciones aplicadas sin alterar valores existentes.
- Ocho evidencias descargadas con manifiesto SHA-256. No es un respaldo completo de Auth ni del proyecto.

El navegador usa SDK/exportadores simulados; PostgreSQL se prueba por separado. Las cuentas reales de los tres lectores se comprobarán cuando estén creadas.

## Servicios reales comprobados

- Supabase: aplicadas las migraciones `internal_roles_and_private_evidence` e `internal_dashboard_summary`.
- Cinco PQRS, un perfil administrador y ocho evidencias conservados. Bucket privado; lectura anónima y RPC pública antigua denegadas.
- Prueba transaccional en Supabase: administrador crea, resuelve y archiva con historial; lector lee casos/evidencias/resumen y no puede insertar, actualizar, borrar casos, cambiar roles o usar RPC de actualización. Se revirtieron todos los datos de prueba. La secuencia puede dejar huecos.
- Vista previa Netlify: SDK real carga, páginas protegidas redirigen al login, endpoints retirados devuelven 410 y archivos privados no se publican. API REST anónima deniega acceso a las tres tablas y a la RPC antigua.
- Producción publicada por Git desde `1b0bcb0`: despliegue `6ae60aa9c67d367db2b6b7d2`, estado ready. La misma comprobación HTTP/navegador pasó en https://peposcake-pqrs.netlify.app/. Escaneo de secretos de Netlify sin coincidencias.

Las versiones registradas por Supabase son `20261031153254` (archivo local 001) y `20261031153306` (archivo local 003). No volver a aplicar automáticamente los archivos locales con `db push` sin reconciliar ese historial.

El asesor de Supabase mantiene avisos sobre funciones SECURITY DEFINER: `es_admin`/`es_lector` solo devuelven el permiso del usuario actual (false para anónimos), y la RPC de estado comprueba el administrador internamente. No devuelven datos por omitir RLS. La protección de contraseñas filtradas de Auth sigue desactivada; revisar su disponibilidad en el plan antes de habilitarla: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Comprobación con cuentas reales

1. Administrador: ingresar, crear un caso, adjuntar imagen, editar y registrar un cambio de estado con comentario. Recargar para comprobar persistencia.
2. Lector: abrir ese caso y comprobar datos, historial e imagen. No deben aparecer Nuevo, Editar, Archivar ni Actualizar estado.
3. Lector: consultar reportes y abrir un PDF/Excel exportado.
4. Administrador: archivar/restaurar. Lector: consultar archivados sin poder restaurarlos.
5. Cerrar sesión y abrir un detalle directamente: debe pedir login. La antigua consulta pública debe llevar al login.

Archivar los casos de prueba; conservar el historial existente.
