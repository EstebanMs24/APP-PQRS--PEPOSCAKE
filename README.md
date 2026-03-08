# 🎂 Pepo's Cake — Sistema de Gestión PQRS

> Aplicación web para registrar, gestionar y hacer seguimiento de **Peticiones, Quejas, Reclamos y Sugerencias** de los clientes de Repostería Pepo's Cake.

---

## 📋 Tabla de Contenidos

- [Descripción del Proyecto](#descripción-del-proyecto)
- [Stack Tecnológico](#stack-tecnológico)
- [Funcionalidades](#funcionalidades)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Base de Datos (Supabase)](#base-de-datos-supabase)
- [Configuración e Instalación](#configuración-e-instalación)
- [Despliegue en Netlify](#despliegue-en-netlify)
- [Uso del Sistema](#uso-del-sistema)
- [Seguridad](#seguridad)
- [Mejoras Futuras](#mejoras-futuras)

---

## 📌 Descripción del Proyecto

**Repostería Pepo's Cake** necesitaba una solución para gestionar los reclamos de sus clientes de manera organizada. Antes del sistema, los reclamos no tenían seguimiento ni trazabilidad.

Esta aplicación web permite al personal de la empresa:

- Registrar PQRS con número de caso único automático
- Clasificar cada caso por **tipo** (Petición / Queja / Reclamo / Sugerencia) y **área responsable** (Producción / Envíos / Entrega / Atención al Cliente)
- Hacer seguimiento del estado del caso con historial de comentarios
- Generar **reportes estadísticos** por área, tipo y mes
- **Exportar a Excel** y **generar PDF** de cada caso

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | HTML5, CSS3, JavaScript (Vanilla) |
| **Base de datos** | [Supabase](https://supabase.com) (PostgreSQL en la nube) |
| **Autenticación** | Supabase Auth (email/contraseña) |
| **Fuentes** | Google Fonts — Nunito |
| **PDF** | [jsPDF](https://github.com/parallax/jsPDF) v2.5.1 (CDN) |
| **Excel** | [SheetJS (xlsx)](https://sheetjs.com) v0.20.1 (CDN) |
| **Hosting** | [Netlify](https://netlify.com) |

> Sin frameworks, sin dependencias npm. Todo funciona directamente en el navegador.

---

## ✅ Funcionalidades

### 🔐 Autenticación
- Login seguro con email y contraseña vía Supabase Auth
- Protección de rutas: redirige al login si no hay sesión activa
- Cierre de sesión desde cualquier página

### 📊 Dashboard
- Tarjetas con totales: Total, Pendientes, En Proceso, Resueltos
- Gráficas de barras CSS (sin librerías) por Área y Tipo
- Tabla con los 10 casos más recientes

### ➕ Registro de PQRS
- Formulario con validación en tiempo real
- Número de caso generado automáticamente por Supabase (`PQR-YYYYMMDD-XXXX`)
- Campos: Cliente, Teléfono, Correo, Tipo, Área, Motivo, Descripción, Comentarios adicionales
- Estado inicial siempre en **Pendiente**

### 📋 Lista de PQRS
- Tabla paginada (15 por página)
- Filtros combinables: texto libre, estado, área, tipo, rango de fechas
- Búsqueda en tiempo real por nombre de cliente o número de caso
- Botón de exportación a Excel

### 👁️ Detalle del Caso
- Vista completa de todos los datos del PQRS
- Cambio de estado (Pendiente → En Proceso → Resuelto)
- Campo de solución obligatorio al marcar como Resuelto
- Registro de comentarios de seguimiento con historial en línea de tiempo
- **Generación de PDF** con formato profesional (colores Pepo's Cake)

### 📈 Reportes
- Filtro por período (fecha desde / hasta)
- KPIs: Total, Pendientes, En Proceso, Resueltos, Tasa de Resolución
- Gráficas por Área, Tipo y evolución mensual
- Tabla de resumen mensual con porcentaje de resolución
- Exportación a Excel con hoja de datos y hoja de resumen estadístico

---

## 📁 Estructura del Proyecto

```
PEPOSPQRS-PRUEBA1/
│
├── index.html              # Página de login
├── dashboard.html          # Panel principal
├── nuevo-pqrs.html         # Formulario de registro
├── lista-pqrs.html         # Listado con filtros
├── detalle-pqrs.html       # Detalle, seguimiento y PDF
├── reportes.html           # Estadísticas y reportes
│
├── css/
│   └── styles.css          # Estilos globales (paleta Pepo's Cake)
│
├── js/
│   ├── supabase-client.js  # Inicialización del cliente Supabase
│   ├── auth.js             # Login, logout, sesión, sidebar responsivo
│   ├── pqrs.js             # Lógica para registrar nuevo PQRS
│   ├── dashboard.js        # Carga de estadísticas y gráficas
│   ├── lista-pqrs.js       # Filtros, paginación y tabla
│   ├── detalle.js          # Ver caso, actualizar estado, PDF
│   ├── reportes.js         # Estadísticas por período
│   └── exports.js          # Exportación Excel (SheetJS)
│
├── supabase/
│   └── schema.sql          # Tablas, triggers y políticas RLS
│
└── netlify.toml            # Configuración de Netlify (rutas + headers)
```

---

## 🗄️ Base de Datos (Supabase)

### Tablas

#### `pqrs` — Tabla principal
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Identificador único |
| `numero_caso` | VARCHAR | Generado automáticamente: `PQR-YYYYMMDD-XXXX` |
| `fecha_registro` | TIMESTAMPTZ | Fecha y hora del registro |
| `nombre_cliente` | VARCHAR | Nombre completo del cliente |
| `telefono_cliente` | VARCHAR | Teléfono de contacto |
| `correo_cliente` | VARCHAR | Correo electrónico |
| `tipo_solicitud` | VARCHAR | Peticion / Queja / Reclamo / Sugerencia |
| `area_responsable` | VARCHAR | Produccion / Envios / Entrega / Atencion_cliente |
| `motivo` | VARCHAR | Resumen del motivo |
| `descripcion` | TEXT | Descripción detallada |
| `comentarios_adicionales` | TEXT | Información adicional |
| `estado` | VARCHAR | Pendiente / En_proceso / Resuelto |
| `solucion` | TEXT | Descripción de la solución |
| `fecha_resolucion` | TIMESTAMPTZ | Cuando se marcó como resuelto |
| `creado_por` | UUID FK | Usuario que lo registró |

#### `seguimiento_pqrs` — Historial de seguimiento
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Identificador |
| `pqrs_id` | UUID FK | Referencia al caso |
| `comentario` | TEXT | Texto del comentario |
| `estado_nuevo` | VARCHAR | Estado al que cambió |
| `nombre_usuario` | VARCHAR | Nombre del agente |
| `creado_en` | TIMESTAMPTZ | Fecha del comentario |

#### `usuarios` — Perfil de usuarios
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Coincide con `auth.users.id` |
| `nombre` | VARCHAR | Nombre completo |
| `correo` | VARCHAR | Correo |
| `rol` | VARCHAR | admin / supervisor / agente |
| `area` | VARCHAR | Área de trabajo |

### Trigger automático
El número de caso (`PQR-20260307-0001`) se genera automáticamente con un trigger PostgreSQL al insertar un nuevo registro.

### Seguridad RLS
Row Level Security activado en todas las tablas. Solo usuarios autenticados pueden leer, insertar o actualizar datos.

---

## ⚙️ Configuración e Instalación

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Espera a que se provisione (aprox. 2 minutos)

### 2. Ejecutar el schema SQL

1. En el panel de Supabase ve a **SQL Editor**
2. Copia y pega todo el contenido de `supabase/schema.sql`
3. Haz clic en **Run**

### 3. Crear el primer usuario

1. Ve a **Authentication → Users → Add user**
2. Ingresa email y contraseña del administrador
3. En **SQL Editor** ejecuta:
```sql
INSERT INTO usuarios (id, nombre, correo, rol)
VALUES (
  'UUID_DEL_USUARIO',   -- Cópialo desde Authentication → Users
  'Administrador',
  'admin@peposcake.com',
  'admin'
);
```

### 4. Conectar la aplicación

Abre `js/supabase-client.js` y reemplaza las dos variables:

```js
const SUPABASE_URL = 'https://TU_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_PUBLIC_KEY';
```

> Encuéntralos en: **Supabase → Settings → API → Project URL y anon public key**

---

## 🚀 Despliegue en Netlify

### Opción A — Desde GitHub (Recomendado)

1. Sube el proyecto a un repositorio de GitHub
2. Ve a [netlify.com](https://netlify.com) → **Add new site → Import an existing project**
3. Conecta tu cuenta de GitHub y selecciona el repositorio
4. Configuración de build:
   - **Publish directory:** `.` (punto, raíz del proyecto)
   - **Build command:** (dejar vacío)
5. Haz clic en **Deploy site**

### Opción B — Arrastrar carpeta

1. Ve a [netlify.com](https://netlify.com) → **Add new site → Deploy manually**
2. Arrastra la carpeta `PEPOSPQRS-PRUEBA1` al área de Netlify

### Variables de entorno (opcional)
Si prefieres no exponer las claves en el código, puedes definirlas en Netlify:
- **Netlify → Site configuration → Environment variables**
- `SUPABASE_URL` y `SUPABASE_ANON_KEY`

> ⚠️ La `anon key` de Supabase es pública por diseño. La seguridad real la provee **Row Level Security (RLS)** en la base de datos.

---

## 📖 Uso del Sistema

### Flujo principal

```
Login → Dashboard → Nuevo PQRS → Asignar área → 
→ Seguimiento → Actualizar estado → Resuelto → PDF
```

### Ciclo de vida de un caso

```
[Pendiente] → [En Proceso] → [Resuelto]
```

Cada cambio de estado requiere un **comentario de seguimiento** obligatorio. Al marcar como **Resuelto** también se registra la **descripción de la solución** y la fecha de resolución.

---

## 🔒 Seguridad

| Capa | Medida implementada |
|---|---|
| **Autenticación** | Supabase Auth JWT |
| **Autorización** | Row Level Security (RLS) en todas las tablas |
| **Transporte** | HTTPS forzado por Netlify |
| **Headers HTTP** | X-Frame-Options, X-Content-Type-Options, CSP, XSS-Protection |
| **Validación** | Validación en frontend + constraints en base de datos |
| **Inyección SQL** | Prevenida por Supabase SDK (queries parametrizadas) |
| **XSS** | Escape de HTML en todo contenido dinámico |

---

## 🚧 Mejoras Futuras

Ver sección de sugerencias en el proyecto. Las principales candidatas son:

- [ ] Notificaciones por WhatsApp/email al crear o resolver un caso
- [ ] Panel de administración de usuarios
- [ ] Modo oscuro
- [ ] Carga de evidencias fotográficas (Supabase Storage)
- [ ] Portal externo para que el cliente consulte su caso por número
- [ ] Tiempo límite de resolución por tipo de caso y alertas de vencimiento

---

## 👥 Equipo

**Repostería Pepo's Cake** — Medellín, Colombia  
Sistema desarrollado para gestión interna de PQRS.

---

*Pepo's Cake PQRS v1.0 — Marzo 2026*
