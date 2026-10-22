# Pepo’s Cake — Gestión de PQRS

Aplicación HTML, CSS y JavaScript sin framework, con Supabase Auth/PostgreSQL/Storage. El panel es exclusivo para administradores activos. `consulta.html` es un portal independiente sin inicio de sesión; usa funciones de servidor en Vercel (también hay adaptadores Netlify).

**Estado de esta entrega:** cambios preparados y pruebas locales. No se aplicaron migraciones ni se desplegó sobre producción. Antes de publicar, completar [validación de staging](docs/VALIDACION.md). Informe completo: [AUDITORIA.md](docs/AUDITORIA.md).

## Ejecutar y comprobar

Requiere Node 22 o superior y npm. Las herramientas de desarrollo no se incluyen en la aplicación del navegador.

```sh
npm ci
npm run check
npm test
npm run test:db
npx playwright install chromium
npm run test:browser
npm run build
npm run dev
```

Abrir `http://localhost:3000`. Sin variables de servidor, la consulta pública informa que no está disponible. Un servidor de archivos estáticos por sí solo no ejecuta `/api/*`. El panel usa la URL y clave **anon pública** de `js/supabase-client.js`; reemplazarlas por las de staging para probar contra un proyecto de pruebas. No introducir service_role en ese archivo.

`test:db` ejecuta PostgreSQL embebido (PGlite) en memoria con Auth y Storage mínimos simulados, sin conexión externa. `test:browser` inicia un servidor en el puerto 3100 y usa un SDK simulado; verifica interacción y capturas, no credenciales reales ni los proveedores. Las bibliotecas PDF/Excel se simulan para comprobar la conexión de los botones; validar también los archivos reales en staging. Las capturas se guardan en `artifacts/` y no se publican. Las fuentes web externas se bloquean en esa prueba y usan sus alternativas locales; los iconos están incluidos con su licencia.

## Configuración del servidor

Copiar `.env.example` a `.env` para desarrollo. Configurar las mismas variables como secretos de entorno en Vercel/Netlify, separando Preview/Staging de Production. No subir `.env` al repositorio.

| Variable | Uso |
|---|---|
| `SUPABASE_URL` | Proyecto Supabase usado por el servidor; debe coincidir con el del panel |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor, permite las dos RPC específicas de consulta |
| `TURNSTILE_SITE_KEY` | Clave pública del widget; se publica únicamente esta variable |
| `TURNSTILE_SECRET_KEY` | Secreto para validar el token CAPTCHA en servidor |
| `TURNSTILE_HOSTNAME` | Dominio exacto autorizado, sin protocolo ni puerto; `localhost` en desarrollo |
| `PUBLIC_ORIGIN` | Origen completo autorizado, p. ej. `https://su-dominio`, sin barra final |
| `RATE_LIMIT_SECRET` | Secreto aleatorio de al menos 32 caracteres para hashes HMAC |

Generar un secreto con `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"` en una terminal privada. No pegarlo en incidencias ni capturas.

Crear un widget Turnstile para los dominios previstos. El servidor exige token válido, hostname exacto y acción `consulta`. Sin CAPTCHA o sin límites disponibles, deniega la consulta. Los tokens deben validarse en servidor: [documentación oficial de Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Base de datos: instalación nueva

1. Crear un proyecto de prueba en Supabase y ejecutar `supabase/schema.sql` **solo en una base vacía**. Este archivo crea tablas con RLS sin otorgar acceso público.
2. Crear la cuenta legítima desde Supabase Auth mediante invitación o creación administrada. Desactivar el registro público de nuevas cuentas en Auth.
3. Desde SQL Editor, crear el perfil con el UUID real. Sustituir los marcadores; no se crean credenciales predeterminadas:

```sql
INSERT INTO public.usuarios (id,nombre,correo,rol,activo)
VALUES ('UUID_REAL_DE_AUTH','NOMBRE_REAL','CORREO_REAL','admin',true);
```

4. Aplicar las tres migraciones en el orden indicado abajo. La primera aborta si no encuentra al menos un administrador activo.
5. Probar el acceso con esa cuenta. Otros roles y perfiles ausentes o inactivos quedan fuera del panel.

## Base existente: actualización controlada

No volver a ejecutar `schema.sql` en una base existente. No ejecutar migraciones directamente sobre producción sin revisión y autorización.

1. Ejecutar `supabase/preflight.sql` y revisar el esquema, políticas, funciones y bucket reales. El repositorio no prueba qué SQL está instalado en Supabase. Revisar especialmente funciones SECURITY DEFINER o vistas adicionales no incluidas aquí.
2. Realizar y verificar respaldo (sección siguiente). Disponer de una copia de staging.
3. Confirmar el perfil del administrador legítimo (`rol='admin' AND activo IS TRUE`). La migración no asciende usuarios ni activa perfiles automáticamente.
4. En staging, aplicar individualmente:
   - `supabase/migrations/202610210001_admin_security.sql`
   - `supabase/migrations/202610210002_public_lookup.sql`
   - `supabase/migrations/202610210003_dashboard.sql`
5. Cada archivo usa una transacción; la primera se probó dos veces consecutivas. Revisar resultados y probar antes de continuar. La secuencia nunca se rebobina y puede dejar huecos, lo cual es normal.
6. Publicar el frontend/API compatible y completar `docs/VALIDACION.md` antes de autorizar producción.

La migración 001 reemplaza las políticas de las tres tablas conocidas (`pqrs`, `usuarios`, `seguimiento_pqrs`), revoca la RPC pública anterior, restringe perfiles, agrega auditoría y vuelve privado `evidencias-pqrs`. Los archivos y números históricos permanecen. Las URL públicas antiguas se interpretan como rutas del mismo proyecto y se firman temporalmente; no se trasladan objetos. La política restrictiva del bucket evita que una política permisiva adicional lo abra. Otros buckets no se modifican.

El consecutivo mantiene `PC-YYYY-NNNNN`, crece sin módulo ni truncamiento y no reinicia anualmente. La unicidad se garantiza en PostgreSQL. Se preservan los identificadores históricos. La creación usa UUID de solicitud estable al reintentar una respuesta incierta; las ediciones/estados detectan versiones obsoletas.

## Respaldo y recuperación

Antes de migrar, verificar un respaldo restaurable de Supabase y guardar el esquema, políticas y configuración del bucket. Si se usa `pg_dump`, emplear la URL de conexión desde una variable privada, nunca una URL con contraseña escrita en documentación:

```sh
pg_dump --dbname="$DATABASE_URL" --format=custom --file=backup-before-pqrs.dump
pg_restore --list backup-before-pqrs.dump
```

En PowerShell, usar `--dbname=$env:DATABASE_URL`. Guardar el archivo en un lugar privado **fuera del directorio publicado**. Ensayar una restauración en otro proyecto; el rol de respaldo debe poder leer las tablas necesarias. Las restricciones de los esquemas administrados de Supabase deben revisarse con el procedimiento de backup del proyecto. Una copia SQL no incluye los bytes de Storage: respaldar también los objetos privados y su inventario con herramientas autorizadas de Supabase.

Para el cambio de producción, programar una ventana de mantenimiento y conservar la versión compatible anterior del frontend. Si una transacción SQL falla, corregir la causa y repetirla; no desactivar RLS. Si el problema aparece después, detener temporalmente la consulta y las escrituras, conservar la base y aplicar una corrección hacia adelante. No restaurar políticas públicas como mecanismo de recuperación. Una restauración completa debe ensayarse en un proyecto separado y conciliar las escrituras posteriores al respaldo antes de cambiar la conexión.

## Consulta pública y privacidad

- Número: número exacto + correo registrado.
- Cédula o teléfono: dato exacto normalizado + número de caso + correo registrado. No devuelve listas de todos los casos de una persona.
- Si un caso no tiene correo, el administrador debe verificar al solicitante y completar/corregir el contacto; no se agrega un acceso alternativo sin verificación.
- Solo devuelve número, fechas de registro/actualización, tipo, estado y área. No publica motivo, solución de texto libre, nombres, cédulas, teléfonos, comentarios ni evidencias.
- Límites transaccionales compartidos: 10 intentos con CAPTCHA válido por IP y por caso cada 15 minutos, más 500 globales por ventana. Los contadores guardan hashes HMAC y caducan; el borrado de entradas de más de un día se realiza en la siguiente solicitud.
- Los números son predecibles y el correo no prueba identidad. CAPTCHA, verificación adicional y límites reducen la enumeración; no ofrecen exclusividad de empleados. Para uso estrictamente interno, poner un control de identidad corporativa o VPN delante del portal y sus API. Evaluar cuotas con la cantidad de empleados que comparten una IP.
- Vercel utiliza su cabecera `x-vercel-forwarded-for`; Netlify entrega `context.ip`. No confiar en una IP enviada dentro del formulario ni en una cabecera arbitraria del cliente.

Las funciones SQL con privilegios están acotadas y revocadas para anon/authenticated salvo los permisos necesarios; ver [funciones de Supabase](https://supabase.com/docs/guides/database/functions). El servidor conserva una segunda lista explícita de campos de salida.

## Panel y reglas de negocio

El administrador puede crear, editar datos y clasificación, cambiar estado con comentario, consultar evidencia privada, exportar, archivar/restaurar y gestionar perfiles de otros usuarios. El historial registra actor, fecha, acción y estado anterior/nuevo. No hay borrado permanente desde la aplicación. Una cuenta no puede cambiar su propio rol o desactivarse. Nuevas cuentas se aprovisionan por el responsable de Auth.

Las evidencias nuevas son JPG/PNG/WebP, máximo cinco por caso y 5 MB cada una; Storage también limita tamaño y MIME declarado. Los enlaces firmados duran 120 segundos. Un error al subir archivos conserva el formulario. Ante una escritura incierta no se borran objetos que podrían haber quedado asociados; revisar objetos huérfanos antes de eliminarlos manualmente. No se implementó eliminación automática de archivos existentes.

SLA: Petición 72 h, Queja/Reclamo 48 h, Sugerencia 120 h. Son ventanas de horas corridas internas, no un cálculo legal de días hábiles. `Resuelto` y `Rechazado` no están vencidos. “Por vencer” es el último 25% de la ventana. Si cambia la política, actualizar `CONFIG.SLA_HORAS`, el agregado SQL de dashboard y sus pruebas juntos.

El dashboard agrega en PostgreSQL y no se limita a las primeras 1.000 filas del API. Lista paginada de 20; reportes/exportaciones leen páginas de 500 con los mismos filtros y un límite de 20.000 registros por operación. Para más volumen, acotar fechas. El orden entre páginas es estable (fecha e ID), pero una exportación no representa una instantánea transaccional si otros administradores escriben durante ella. Las fechas se muestran y filtran en `America/Bogota`.

## Despliegue

### Vercel

Importar el repositorio como proyecto “Other”, Node 22+, respetar `vercel.json`: build `npm run build`, salida `dist`, funciones de servidor en `api/`. Configurar secretos y CAPTCHA en Preview. La compilación solo copia HTML, `js`, `css` e `img`: no publica SQL, pruebas, dependencias o archivos de entorno. Validar en preview y luego aplicar el procedimiento de producción autorizado. No ejecutar SQL desde el build.

### Netlify

`netlify.toml` conserva el hosting alternativo, construye `dist` y enruta `/api/*` a adaptadores `netlify/functions/*.mjs`. Usan Request/Response y `context.ip`, documentados en la [API oficial](https://docs.netlify.com/build/functions/api/). Configurar las mismas variables (sin establecer `VERCEL`) y validar el despliegue real antes de publicar. El arrastre de una carpeta estática no incluye las funciones necesarias.

## Estructura relevante

- `js/auth.js`: autenticación y autorización del panel.
- `js/data.js`: filtros compartidos, exportaciones paginadas y referencias de evidencia.
- `js/pqrs.js`: creación/edición; `js/detalle.js`: estado, historial y evidencia.
- `js/consulta.js` + `api/consulta.js`: consulta separada y controles de servidor.
- `css/styles.css`: tokens y componentes existentes; iconos locales con licencia en `licenses/`.
- `supabase/migrations/`: cambios versionados, sin ejecución automática.
- `tests/`: controles de seguridad, PostgreSQL aislado y navegador.
- `docs/`: diagnóstico, resultados y validación pendiente de servicios reales.
