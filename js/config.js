// ============================================================
// CONFIG.JS - Configuración centralizada del sistema
// Fuente de verdad para constantes de negocio y límites
// ============================================================

const CONFIG = {
  // Supabase - REEMPLAZAR CON VALORES REALES
  SUPABASE_URL: '[REEMPLAZAR_CON_SUPABASE_URL]',
  SUPABASE_ANON_KEY: '[REEMPLAZAR_CON_SUPABASE_ANON_KEY]',

  // Sistema
  APP_NAME: "Pepo's Cake - PQRS",
  APP_VERSION: '2.0.0',
  LANG: 'es-CO',

  // Roles
  ROLES: {
    CLIENTE: 'cliente',
    EMPLEADO: 'empleado',
    ADMIN: 'admin'
  },

  // Permisos por rol
  PERMISOS: {
    cliente: ['crear_pqrs', 'consultar_propios'],
    empleado: ['crear_pqrs', 'ver_asignados', 'editar_propios', 'exportar'],
    admin: ['crear_pqrs', 'ver_todos', 'editar_todos', 'eliminar', 'exportar', 'configurar_usuarios']
  },

  // Estados
  ESTADOS: {
    PENDIENTE: 'Pendiente',
    EN_PROCESO: 'En_proceso',
    RESUELTO: 'Resuelto',
    RECHAZADO: 'Rechazado'
  },

  // Tipos
  TIPOS: {
    PETICION: 'Peticion',
    QUEJA: 'Queja',
    RECLAMO: 'Reclamo',
    SUGERENCIA: 'Sugerencia'
  },

  // Áreas
  AREAS: {
    PRODUCCION: 'Produccion',
    ENVIOS: 'Envios',
    ENTREGA: 'Entrega',
    ATENCION_CLIENTE: 'Atencion_cliente'
  },

  // SLA en horas
  SLA_HORAS: {
    Peticion: 72,
    Queja: 48,
    Reclamo: 48,
    Sugerencia: 120
  },

  // Colores
  COLOR_ESTADO: {
    'Pendiente': '#E07B39',
    'En_proceso': '#4AADA8',
    'Resuelto': '#6BAE75',
    'Rechazado': '#D64045'
  },

  // Tablas
  TABLA_PQRS: 'pqrs',
  TABLA_USUARIOS: 'usuarios',
  TABLA_HISTORICO: 'seguimiento_pqrs',

  // Paginación
  ITEMS_POR_PAGINA: 20,
  PAGE_SIZE: 20,

  // Límites
  MAX_TAGS: 10,
  MAX_IMAGENES: 5,
  MAX_IMAGEN_MB: 5,

  // Temas
  TEMAS: {
    LIGHT: 'light',
    DARK: 'dark'
  },

  // Storage keys
  STORAGE_KEYS: {
    TOKEN: 'pqrs_token',
    USUARIO: 'pqrs_usuario',
    TEMA: 'pqrs_tema',
    SIDEBAR: 'pqrs_sidebar_open'
  }
};

// Alias para compatibilidad con código existente
const PEPOSCAKE_CONFIG = {
  PAGE_SIZE: CONFIG.PAGE_SIZE,
  MAX_TAGS: CONFIG.MAX_TAGS,
  MAX_IMAGENES: CONFIG.MAX_IMAGENES,
  MAX_IMAGEN_MB: CONFIG.MAX_IMAGEN_MB
};

// Helpers
function tienePermiso(rolUsuario, permisoRequerido) {
  if (!rolUsuario || !CONFIG.PERMISOS[rolUsuario]) return false;
  return CONFIG.PERMISOS[rolUsuario].includes(permisoRequerido);
}

function getLabelEstado(estado) {
  const map = {
    'Pendiente': 'Pendiente',
    'En_proceso': 'En Proceso',
    'Resuelto': 'Resuelto',
    'Rechazado': 'Rechazado'
  };
  return map[estado] || estado;
}

function getLabelTipo(tipo) {
  const map = {
    'Peticion': 'Petición',
    'Queja': 'Queja',
    'Reclamo': 'Reclamo',
    'Sugerencia': 'Sugerencia'
  };
  return map[tipo] || tipo;
}

function getLabelArea(area) {
  const map = {
    'Produccion': 'Producción',
    'Envios': 'Envíos',
    'Entrega': 'Entrega',
    'Atencion_cliente': 'Atención al Cliente'
  };
  return map[area] || area;
}
