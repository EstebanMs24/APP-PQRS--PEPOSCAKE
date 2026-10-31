# Pepo’s Cake — PQRS interno

Aplicación HTML/CSS/JavaScript con Supabase Auth/PostgreSQL/Storage, publicada en https://peposcake-pqrs.netlify.app/ mediante Netlify.

## Acceso

Cada persona usa su propia cuenta. Un administrador crea, edita, cambia estados, archiva/restaura y gestiona usuarios. Tres usuarios de consulta ven todos los casos, datos personales, historial, evidencias y archivados; pueden consultar reportes y exportarlos. No hay borrado definitivo de casos desde la aplicación.

El rol de consulta se guarda como `empleado` por compatibilidad. Solo perfiles `admin` o `empleado` con `activo=true` acceden. Los perfiles ausentes, inactivos o `cliente` quedan fuera. Las políticas RLS bloquean escrituras de lectores incluso mediante llamadas directas a la API y les impiden cambiar su rol.

La consulta anónima está retirada: `consulta.html` dirige al login y las antiguas API responden 410 sin consultar datos. No se requiere CAPTCHA ni secretos de servidor. La URL y clave pública están en `js/supabase-client.js`; nunca poner allí `service_role` ni claves `sb_secret_`.

## Alta de lectores

Crear cada cuenta desde Supabase → Authentication → Users → Add user, mediante creación administrada. Desactivar el registro público en Auth. Crear el perfil desde SQL Editor con el UUID real de Auth:

```sql
INSERT INTO public.usuarios(id,nombre,correo,rol,activo)
VALUES ('UUID_REAL_DE_AUTH','NOMBRE_REAL','CORREO_REAL','empleado',true);
```

El administrador puede desactivar cuentas desde Usuarios. No compartir contraseñas en el chat ni en el repositorio.

## Desarrollo

Node 22+ y npm:

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

Abrir http://localhost:3000. PGlite prueba PostgreSQL en memoria. Playwright usa un SDK y bibliotecas de exportación simulados: no sustituye la prueba con cuentas reales. Capturas y copias privadas se guardan en `artifacts/`, excluido de Git y del despliegue.

## Migraciones

En una base existente, no volver a ejecutar `supabase/schema.sql`. Revisar `supabase/preflight.sql` y verificar respaldo antes de aplicar:

1. `202610210001_admin_security.sql`: lectura interna, escritura solo del administrador, historial, evidencias privadas y consecutivo sin truncamiento.
2. `202610210002_public_lookup.sql`: retirado antes de instalarse, no realiza cambios.
3. `202610210003_dashboard.sql`: resumen agregado para ambos roles internos activos.

La primera exige un administrador activo. Conserva casos, identificadores y archivos. Las URL antiguas de evidencias se convierten en rutas y se firman temporalmente para usuarios autorizados. No se ejecuta SQL durante el build.

El consecutivo `PC-YYYY-NNNNN` no se reinicia anualmente y puede tener huecos. Las ediciones detectan versiones obsoletas. Los SLA son horas corridas internas, no plazos legales: petición 72, queja/reclamo 48, sugerencia 120. Fechas en America/Bogota. Exportaciones paginadas con límite de 20.000 registros.

## Despliegue y recuperación

Netlify compila con `npm run build` y publica `dist/`, que solo contiene HTML, JS, CSS e imágenes. No publica SQL, pruebas, secretos ni copias. Las dos funciones antiguas solo responden 410. Validar una vista previa y mantener Git sincronizado: un push a `main` puede generar otro despliegue automático.

Guardar copias privadas de datos, esquema, políticas y evidencias antes de migrar. Un snapshot de las tablas de la aplicación no sustituye un respaldo completo de Auth ni del proyecto. Ensayar la recuperación en otra base y corregir hacia adelante, sin volver a publicar versiones que expongan datos.

El informe `docs/AUDITORIA.md` describe el alcance histórico. El alcance vigente es interno, como se describe aquí. Validación actual en `docs/VALIDACION.md`.
