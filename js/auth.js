// ============================================================
// AUTH.JS - Autenticación, sesión y control de acceso
// ============================================================

// Páginas protegidas que requieren autenticación
const PROTECTED_PAGES = ['dashboard', 'nuevo-pqrs', 'lista-pqrs', 'detalle-pqrs', 'reportes'];

// Inicializar auth
document.addEventListener('DOMContentLoaded', () => {
  withSupabase(async (db) => {
    const pagina = extraerNombrePagina();
    const esRegistro = pagina === 'registro';
    const esLogin = pagina === 'index';
    const esProtegida = PROTECTED_PAGES.includes(pagina);

    // En registro: si hay sesión activa, ir a dashboard
    if (esRegistro) {
      const { data: { session } } = await db.auth.getSession();
      if (session && await usuarioActivo(db, session.user.id)) {
        window.location.href = 'dashboard.html';
      }
      return;
    }

    const { data: { session } } = await db.auth.getSession();

    // En login: mostrar aviso si fue expulsado por cuenta pendiente
    if (esLogin) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('pendiente') === '1') {
        mostrarError(document.getElementById('loginError'),
          'Tu cuenta está pendiente de aprobación por un administrador.');
      }
    }

    // Página protegida sin sesión → login
    if (esProtegida && !session) {
      window.location.href = 'index.html';
      return;
    }

    // Login con sesión → dashboard (solo si la cuenta está activa)
    if (esLogin && session) {
      if (await usuarioActivo(db, session.user.id)) {
        window.location.href = 'dashboard.html';
      } else {
        await db.auth.signOut();
      }
      return;
    }

    // Cargar datos de usuario si hay sesión
    if (session) {
      await cargarDatosUsuario(db, session.user.id);
      // Si la cuenta fue desactivada, cerrar sesión y volver al login
      if (window.currentUser && window.currentUser.activo === false) {
        await db.auth.signOut();
        window.location.href = 'index.html?pendiente=1';
        return;
      }
      updateRoleBasedElements();
    }

    // Inicializar componentes
    initSidebar();
    initDarkMode();
  });

  // Event listeners
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registroForm')?.addEventListener('submit', handleRegistro);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('togglePassword')?.addEventListener('click', togglePasswordVisibility);
  document.getElementById('togglePasswordConfirm')?.addEventListener('click', togglePasswordConfirmVisibility);
});

// ============================================================
// Autenticación
// ============================================================
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errorEl = document.getElementById('loginError');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    mostrarError(errorEl, 'Por favor completa todos los campos.');
    return;
  }

  setLoading(btn, true);
  errorEl.style.display = 'none';

  withSupabase(async (db) => {
    const { data: signInData, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      const mensaje = error.message?.toLowerCase().includes('invalid')
        ? 'Correo o contraseña incorrectos.'
        : error.message || 'Error al iniciar sesión.';
      mostrarError(errorEl, mensaje);
      setLoading(btn, false);
      return;
    }

    // Verificar que la cuenta esté aprobada por un admin
    const activo = await usuarioActivo(db, signInData.user.id);
    if (!activo) {
      await db.auth.signOut();
      mostrarError(errorEl, 'Tu cuenta está pendiente de aprobación por un administrador.');
      setLoading(btn, false);
      return;
    }

    setTimeout(() => window.location.href = 'dashboard.html', 500);
  });
}

async function handleRegistro(e) {
  e.preventDefault();
  const btn = document.getElementById('registroBtn');
  const errorEl = document.getElementById('registroError');
  const successEl = document.getElementById('registroSuccess');
  const nombre = document.getElementById('nombre').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const passwordConfirm = document.getElementById('passwordConfirm').value;

  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  // Validaciones
  if (!nombre || !email || !password || !passwordConfirm) {
    mostrarError(errorEl, 'Por favor completa todos los campos.');
    return;
  }

  if (password !== passwordConfirm) {
    mostrarError(errorEl, 'Las contraseñas no coinciden.');
    return;
  }

  if (password.length < 6) {
    mostrarError(errorEl, 'La contraseña debe tener al menos 6 caracteres.');
    return;
  }

  if (!email.includes('@')) {
    mostrarError(errorEl, 'Por favor ingresa un correo válido.');
    return;
  }

  setLoading(btn, true);

  withSupabase(async (db) => {
    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await db.auth.signUp({
      email,
      password,
      options: { data: { nombre } }
    });

    if (authError) {
      const msg = authError.message?.includes('already registered')
        ? 'Este correo ya está registrado.'
        : authError.message || 'Error al registrar.';
      mostrarError(errorEl, msg);
      setLoading(btn, false);
      return;
    }

    // Insertar en tabla usuarios: rol 'empleado' y CUENTA INACTIVA
    // hasta que un administrador la apruebe (activo = false)
    const { error: dbError } = await db
      .from('usuarios')
      .insert({
        id: authData.user.id,
        correo: email,
        nombre: nombre,
        rol: 'empleado',
        activo: false
      });

    if (dbError) {
      mostrarError(errorEl, 'Error al guardar perfil. Contacta soporte.');
      setLoading(btn, false);
      return;
    }

    // La cuenta queda pendiente de aprobación: cerrar cualquier sesión
    // creada por signUp para que NO acceda al sistema todavía.
    if (authData.session) {
      await db.auth.signOut();
    }

    mostrarExito(successEl,
      'Cuenta creada. Tu acceso queda pendiente de aprobación por un administrador. Te avisaremos cuando esté activa.');
    setLoading(btn, false);
    setTimeout(() => window.location.href = 'index.html', 3500);
  });
}

async function handleLogout() {
  withSupabase(async (db) => {
    await db.auth.signOut();
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USUARIO);
    window.location.href = 'index.html';
  });
}

// ============================================================
// Usuario
// ============================================================
async function cargarDatosUsuario(db, userId) {
  const { data: perfil } = await db
    .from('usuarios')
    .select('id, nombre, rol, correo, activo')
    .eq('id', userId)
    .single();

  if (perfil) {
    window.currentUser = perfil;
    window.currentUserRol = perfil.rol;
    localStorage.setItem(CONFIG.STORAGE_KEYS.USUARIO, JSON.stringify(perfil));

    const nombreEl = document.getElementById('userName');
    const rolEl = document.getElementById('userRole');
    if (nombreEl) nombreEl.textContent = perfil.nombre || 'Usuario';
    if (rolEl) rolEl.textContent = getLabelRol(perfil.rol);
  }
}

// Devuelve true si la cuenta está aprobada (activa).
// Los usuarios legacy sin valor se tratan como activos.
async function usuarioActivo(db, userId) {
  const { data } = await db
    .from('usuarios')
    .select('activo')
    .eq('id', userId)
    .single();
  return !data || data.activo !== false;
}

function getCurrentUser() {
  const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.USUARIO);
  return stored ? JSON.parse(stored) : null;
}

function getLabelRol(rol) {
  const map = {
    'cliente': 'Cliente',
    'empleado': 'Empleado',
    'admin': 'Administrador'
  };
  return map[rol] || 'Usuario';
}

function tieneRol(rolRequerido) {
  return window.currentUserRol === rolRequerido;
}

function puedeAcceder(permisoRequerido) {
  const rol = window.currentUserRol;
  return tienePermiso(rol, permisoRequerido);
}

// ============================================================
// Sidebar
// ============================================================
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const menuToggle = document.getElementById('menuToggle');
  const sidebarClose = document.getElementById('sidebarClose');

  if (!sidebar) return;

  function abrirSidebar() {
    sidebar.classList.add('open');
    overlay?.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function cerrarSidebar() {
    sidebar.classList.remove('open');
    overlay?.classList.remove('visible');
    document.body.style.overflow = '';
  }

  menuToggle?.addEventListener('click', abrirSidebar);
  sidebarClose?.addEventListener('click', cerrarSidebar);
  overlay?.addEventListener('click', cerrarSidebar);

  // Cerrar al hacer click en un enlace
  sidebar.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', cerrarSidebar);
  });
}

// ============================================================
// Dark Mode
// ============================================================
function initDarkMode() {
  const tema = localStorage.getItem(CONFIG.STORAGE_KEYS.TEMA) || 'light';
  if (tema === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  const topbarActions = document.querySelector('.topbar-actions');
  if (!topbarActions) return;

  const btn = document.createElement('button');
  btn.id = 'darkToggle';
  btn.className = 'btn-dark-toggle';
  btn.title = 'Alternar modo oscuro';
  btn.type = 'button';
  btn.innerHTML = tema === 'dark'
    ? '<i class="bi bi-sun-fill"></i>'
    : '<i class="bi bi-moon-fill"></i>';

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(CONFIG.STORAGE_KEYS.TEMA, 'light');
      btn.innerHTML = '<i class="bi bi-moon-fill"></i>';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem(CONFIG.STORAGE_KEYS.TEMA, 'dark');
      btn.innerHTML = '<i class="bi bi-sun-fill"></i>';
    }
  });

  topbarActions.insertBefore(btn, topbarActions.firstChild);
}

// ============================================================
// Utilidades
// ============================================================
function extraerNombrePagina() {
  const path = window.location.pathname;
  return (path.split('/').pop() || '').replace('.html', '') || 'index';
}

function setLoading(btn, loading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text) text.style.display = loading ? 'none' : '';
  if (loader) loader.style.display = loading ? 'inline' : 'none';
}

function mostrarError(el, msg) {
  if (!el) return;
  el.textContent = '❌ ' + msg;
  el.style.display = 'block';
}

function mostrarExito(el, msg) {
  if (!el) return;
  el.textContent = '✅ ' + msg;
  el.style.display = 'block';
}

function togglePasswordVisibility() {
  const pwd = document.getElementById('password');
  if (!pwd) return;
  pwd.type = pwd.type === 'password' ? 'text' : 'password';
  const btn = document.getElementById('togglePassword');
  if (btn) btn.innerHTML = pwd.type === 'password'
    ? '<i class="bi bi-eye-fill"></i>'
    : '<i class="bi bi-eye-slash-fill"></i>';
}

function togglePasswordConfirmVisibility() {
  const pwd = document.getElementById('passwordConfirm');
  if (!pwd) return;
  pwd.type = pwd.type === 'password' ? 'text' : 'password';
  const btn = document.getElementById('togglePasswordConfirm');
  if (btn) btn.innerHTML = pwd.type === 'password'
    ? '<i class="bi bi-eye-fill"></i>'
    : '<i class="bi bi-eye-slash-fill"></i>';
}

function updateRoleBasedElements() {
  const rol = window.currentUserRol || 'cliente';
  document.querySelectorAll('[data-rol-minimo]').forEach((el) => {
    const requiredRol = el.getAttribute('data-rol-minimo');
    const puedeVer = rol === requiredRol ||
      (requiredRol === 'empleado' && rol === 'admin') ||
      rol === 'admin';
    el.style.display = puedeVer ? '' : 'none';
  });
}
