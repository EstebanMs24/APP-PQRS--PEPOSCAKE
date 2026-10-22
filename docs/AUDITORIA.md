# Auditoría y entrega — Pepo’s Cake PQRS

Fecha: 21 de octubre de 2026 (America/Bogota). Base inspeccionada: commit `ced7dfc`. El árbol Git estaba limpio al comenzar. Los cambios están en el directorio de trabajo; no se hizo commit, push, despliegue ni operación sobre la base real.

## A. Resumen ejecutivo

Se conservó la aplicación multipágina de HTML/CSS/JavaScript y Supabase. Se corrigieron permisos, acceso sin perfil, persistencia, consultas y fallos de interfaz; se agregó edición reutilizando el formulario existente, un portal independiente con endpoint protegido y una batería reproducible de pruebas. El diseño conserva los recursos de marca e incorpora controles más sobrios, consistencia visual y accesibilidad.

El trabajo está preparado para revisión y validación de staging. La seguridad en producción depende de aplicar las migraciones revisadas y configurar los servicios. El esquema y las políticas realmente desplegadas en Supabase no estuvieron disponibles; no se afirma que el servicio real ya esté corregido.

Se trabajó por etapas: auditoría; correcciones críticas y pruebas SQL; consulta/operaciones y pruebas de servidor; rediseño y pruebas de navegador; revisión visual y documentación. Las pruebas detectaron problemas de migración que se corrigieron antes de continuar. No se mezcló la publicación del diseño con cambios de permisos en producción.

## B. Errores encontrados y corregidos

| Nivel / archivo | Problema y causa | Corrección | Verificación |
|---|---|---|---|
| Crítico — `supabase/schema.sql` | Políticas concedían escritura a cualquier autenticado, sin rol ni activo | Migración 001: autorización por perfil activo, RLS por operación y grants mínimos | PostgreSQL aislado: anon, empleado, sin perfil, admin e inactivo |
| Crítico — `js/auth.js` | Perfil ausente se consideraba activo; páginas cargaban datos antes de finalizar autorización | Denegación por defecto, perfil remoto y promesa compartida de autorización | Pruebas unitarias y redirecciones de navegador |
| Crítico — Storage / `js/pqrs.js`, `js/detalle.js` | Bucket público y URL interpolada directamente | Bucket privado, políticas restrictivas y firmas temporales; rutas del proyecto verificadas y DOM seguro | SQL de políticas y pruebas de referencias; Storage real pendiente |
| Alto — `supabase/schema.sql` | RPC hacía referencia a `eliminado` antes de crear la columna | Esquema base para instalación nueva y migraciones ordenadas | Ejecución real del SQL en PGlite |
| Alto — generador SQL | Módulo 100.000 repetía números; LPAD podía truncar | Secuencia sin módulo, padding no truncante y sincronización que no retrocede | Inserciones más allá de 99.999, rechazo de datos inválidos y migración repetida |
| Alto — consulta anterior | RPC exponía motivo/solución libre y carecía de límites de intentos | RPC antigua revocada; nueva función solo para servidor, seis campos autorizados, CAPTCHA y cuotas | SQL y 12 pruebas automatizadas de servidor/utilidades/adaptador |
| Alto — `js/supabase-client.js` | `withSupabase` no devolvía una promesa; UI terminaba carga antes del resultado | SDK compartido con espera y manejo asíncrono | Flujos de navegador, sintaxis y errores de conexión simulados |
| Alto — `js/pqrs.js` | Se intentaba crear un perfil con rol inválido; errores de subida se ignoraban | Administrador verificado; eliminación de creación de perfiles implícita; abortar guardado incompleto | Navegador: carga fallida conserva formulario y no crea registro |
| Alto — `js/pqrs.js` | Respuesta incierta podía provocar una segunda creación | UUID estable durante reintento y confirmación del caso ya creado; versiones para editar | Navegador: respuesta perdida tras guardar y reintento sin duplicar |
| Alto — `js/detalle.js` | Estado e historial se guardaban por separado; error de historial ignorado | RPC transaccional, comentario validado y control de versión | SQL: éxito, comentario inválido y versión obsoleta |
| Alto — fechas/estado | Reapertura conservaba fecha de resolución; plazos visuales inconsistentes | Trigger normaliza fechas y detalle usa SLA compartido | SQL de reapertura y pruebas de SLA de casos cerrados |
| Alto — listado | Motivo se insertaba sin escapar; acción llamaba una función de banner inexistente | Escape de texto, eventos sin cadenas de código y notificaciones compartidas | Navegador sin errores y pruebas de escape |
| Medio — `js/lista-pqrs.js`, `js/data.js` | Etiqueta sin aplicar; exportación omitía prioridad/cédula y podía truncarse | Filtros únicos, etiqueta exacta, orden y páginas de exportación | Pruebas de filtros y navegador |
| Medio — `js/dashboard.js`, reportes | Estadísticas calculadas sobre respuesta potencialmente limitada a 1.000 filas | Dashboard agregado en SQL; reportes paginados con límite explícito | SQL con 1.007 casos activos; interfaz de reportes |
| Medio — fechas | Filtros y exportación dependían de la zona del computador | Zona de Bogotá y límite superior exclusivo del día siguiente | Prueba de fecha cercana a medianoche y filtro de fin de día |
| Medio — `js/usuarios.js` | UPDATE sin comprobar filas podía aparentar éxito | `.select().single()`, rol activo estricto y bloqueo de cambios propios en RLS | SQL y flujo de usuarios simulado |
| Medio — modales/CSS | Enter confirmaba globalmente; foco y cabecera móvil deficientes | Cancelar enfocado, tabulación contenida, Escape, foco restaurado, navegación inert y cabecera adaptable | Navegador, teclado y capturas revisadas |
| Medio — documentación/hosting | README desactualizado; raíz completa como carpeta publicada | README nuevo, build con lista de recursos permitidos y funciones de servidor | Build ejecutado y revisión de `dist/` |

No se borraron datos, evidencia ni funcionalidades de reportes. El registro público se reemplazó por una pantalla de acceso administrado conforme al requisito de permisos. La consulta de soluciones de texto libre se retiró del portal por no existir un campo separado aprobado para publicación.

## C. Cambios visuales

Se actualizaron login, dashboard, listado, creación/edición, detalle, reportes, usuarios, registro administrado y consulta. Tokens ajustados en la hoja existente: fondo neutro cálido, verde de marca con mayor contraste, controles de 44 px, bordes/sombras discretos y espacios consistentes. Se conservaron las imágenes de marca y el tema oscuro.

El dashboard incorpora una orientación breve, indicadores reales, tendencias y hasta cinco solicitudes abiertas de prioridad alta. Las tablas mantienen filtros y vista móvil. El formulario sirve también para editar y conserva evidencia previa. La consulta muestra instrucciones, verificación y resultado sin navegación administrativa. Los iconos existentes se sirven localmente con su licencia MIT.

Se añadieron etiquetas asociadas, mensajes accesibles, enlace para saltar al contenido, títulos principales, foco visible, selección de archivos por teclado, confirmación de archivado y soporte de movimiento reducido. Las capturas usan datos ficticios de pruebas, nunca cifras de producción.

## D. Cambios de seguridad

Administrador activo comprobado en el cliente y en PostgreSQL; ningún perfil ausente, rol ordinario o estado inactivo concede administración. Sin alta pública de administradores ni credenciales predeterminadas. UPDATE de perfiles propios bloqueado; historial sin permisos de edición/borrado desde el navegador. La auditoría registra las operaciones de creación, actualización, archivado y restauración, con actor y estados; no es un versionado completo de cada texto antiguo.

Consulta únicamente a través del servidor, con CAPTCHA verificado, cuotas compartidas por IP/caso/global, validación exacta y campos mínimos. Cédula/teléfono requieren también número de caso y correo. No se exponen datos de otros casos, listados de personas, evidencia, nombres ni respuestas internas. La ausencia de login no equivale a acceso exclusivo de empleados.

Storage privado y enlaces de 120 segundos, conservación de objetos y referencias históricas. Las migraciones no se ejecutan desde el build. En la revisión de los archivos del navegador no aparecieron referencias a las claves privadas del nuevo backend.

## E. Archivos principales

- Modificados: páginas HTML y `css/styles.css`; módulos de auth, cliente Supabase, PQRS, detalle, listado, dashboard, reportes, exportación, usuarios, configuración y utilidades.
- Nuevos: `js/data.js`, `js/consulta.js`, `api/consulta.js`, `api/public-config.js` y adaptadores Netlify.
- SQL: esquema de instalación corregido, `preflight.sql` y migraciones `202610210001` a `003`.
- Operación: `.env.example`, `.gitignore`, `package.json` y lockfile, scripts de desarrollo/check/build, README y guía de validación.
- Calidad: pruebas unitarias/API, PostgreSQL y navegador; iconos y licencia local.
- No se eliminaron archivos originales del proyecto. Dependencias y capturas quedan fuera de Git y de publicación.

## F. Pruebas

**Ejecutadas y superadas en esta sesión:**

- `npm run check`: sintaxis de 21 archivos JavaScript, scripts inline y referencias HTML locales.
- `npm test`: 12 pruebas superadas; métodos/origen, campos públicos, CAPTCHA, cuota, fallos cerrados, búsqueda, perfil, SLA/fecha, referencias de evidencia, filtros y contrato Netlify.
- `npm run test:db`: esquema nuevo, actualización de políticas permisivas, repetición de migración, permisos, historial transaccional, reapertura, archivo, Storage simulado, RPC antigua bloqueada, búsqueda por tres criterios, cuotas, secuencia sin wrap y estadísticas con más de 1.000 casos.
- `npm run test:browser`: login/logout, denegación de acceso, crear/editar/recargar, estado, archivar/restaurar, filtros, exportación conectada, consultas públicas, no coincidencia y exceso de intentos. Regresiones de subida fallida, reintento tras respuesta perdida y cabecera móvil. Seis pantallas administrativas a 390 px, consulta a 390 px, escritorio y comprobación adicional a 320 px. Sin errores JavaScript capturados.
- `npm run build` y revisión de `dist`: solo recursos públicos previstos.
- `git diff --check`: sin errores de whitespace.

**Fallos encontrados durante el trabajo, corregidos:** modificación del tipo de número antes de retirar su trigger dependiente; sintaxis de CASE en el limitador SQL. Ambos se detectaron con PostgreSQL aislado, se corrigieron y se reejecutaron. La inspección visual detectó acciones fuera de la altura de cabecera móvil; se ajustó y se agregó una comprobación geométrica.

**Pendientes de servicios reales:** Auth, perfiles y RLS desplegados; carga/descarga/firma real de Storage; CAPTCHA válido/expirado/reutilizado con el dominio real; IP y CSP en hosting; archivos reales PDF/Excel; restauración de respaldo y pruebas concurrentes entre procesos independientes. El navegador simula backend y bibliotecas de exportación; PGlite simula los esquemas administrados de Supabase. No se certifica producción ni accesibilidad exhaustiva con estas pruebas.

## G. Configuración pendiente

Configurar las siete variables de `.env.example`, URL/anon del frontend para cada entorno, widget y dominios Turnstile, cuenta administrativa real, registro público deshabilitado en Auth y las tres migraciones. Revisar preflight y cualquier función/vista no incluida en el repositorio. Completar [VALIDACION.md](VALIDACION.md).

## H. Despliegue

El [README](../README.md) contiene comandos locales, instalación nueva, actualización, respaldo, recuperación, Vercel y Netlify. Flujo: respaldo restaurado en staging → migración 001 y acceso/evidencias → 002 y consulta → 003 y métricas → frontend/API compatible → validación → autorización de producción. Coordinar bucket privado y cliente de enlaces firmados para evitar interrupciones temporales.

No se realizó despliegue ni se solicitó acceso a datos de clientes. El sitio necesita funciones de servidor; no basta con subir una carpeta estática.

## I. Riesgos pendientes

- Estado real de Supabase/hosting desconocido: aplicar y validar; los cambios locales por sí solos no corrigen permisos existentes en producción.
- Número+correo no acredita identidad de empleado. Para exclusividad interna hace falta una capa de acceso corporativo/VPN; para detalle personal, una verificación más fuerte.
- Casos sin correo no pueden usar el portal hasta completar un contacto verificado. Los campos históricos no modificados se preservan para no bloquear seguimiento; la edición de datos incompletos puede exigir corregirlos.
- Evidencias que fueron públicas pueden seguir existiendo fuera del sistema o en cachés ajenas; privatizar no recupera copias ya descargadas.
- Errores de red pueden dejar objetos sin asociar; no se borran automáticamente por riesgo de eliminar una evidencia sí guardada. Revisar inventario antes de limpiar.
- Reportes de hasta 20.000 filas; exportaciones no son una instantánea transaccional bajo escrituras simultáneas. Las cuotas deben calibrarse si muchos empleados comparten IP.
- Fuentes, SDK y bibliotecas de exportación aún usan CDN; hay manejo de errores y fuentes alternativas. Se conserva `unsafe-inline` en CSP por compatibilidad con scripts/acciones heredadas; su retirada requiere extraer los restantes scripts/handlers.

## J. Próximas mejoras

Verificación corporativa si el portal será exclusivo de empleados; seguimiento público con un campo editorial separado y aprobado; limpieza auditada de archivos huérfanos; exportación por instantánea si crece el volumen; pruebas programadas de staging y eliminación progresiva de JavaScript inline. Ninguna de estas mejoras requiere reescribir la aplicación.
