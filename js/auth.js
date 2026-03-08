// ============================================================
// AUTH.JS - Manejo de autenticación y sesión
// ============================================================

// Páginas que NO requieren autenticación
const PUBLIC_PAGES = ['index.html', 'registro.html', '/'];

// Inicializa auth en cada página
document.addEventListener('DOMContentLoaded', () => {
  withSupabase(async (db) => {
    const { data: { session } } = await db.auth.getSession();
    const path = window.location.pathname;
    const isPublic = PUBLIC_PAGES.some(p => path.endsWith(p)) || path === '/';
    const isRegistroPage = path.endsWith('registro.html');

    if (!session && !isPublic) {
      window.location.href = 'index.html';
      return;
    }
    // No redirigir desde la página de registro (debe manejar su propia redirección)
    if (session && isPublic && !isRegistroPage) {
      window.location.href = 'dashboard.html';
      return;
    }

    // Si hay sesión, poblar datos de usuario en el sidebar
    if (session) {
      const email = session.user.email || '';
      const nombreEl = document.getElementById('userName');
      const rolEl = document.getElementById('userRole');
      if (nombreEl) nombreEl.textContent = email.split('@')[0];
      if (rolEl) rolEl.textContent = 'Agente';

      // Cargar datos adicionales del perfil
      const { data: perfil } = await db
        .from('usuarios')
        .select('nombre, rol')
        .eq('id', session.user.id)
        .single();
      if (perfil) {
        if (nombreEl) nombreEl.textContent = perfil.nombre;
        if (rolEl) rolEl.textContent = capitalize(perfil.rol);
      }
    }

    // Inicializar sidebar móvil y modo oscuro
    initSidebar();
    initDarkMode();
  });

  // Formulario de login
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Formulario de registro
  const registroForm = document.getElementById('registroForm');
  if (registroForm) {
    registroForm.addEventListener('submit', handleRegistro);
  }

  // Botón de logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Toggle password
  const togglePassword = document.getElementById('togglePassword');
  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      const pwd = document.getElementById('password');
      pwd.type = pwd.type === 'password' ? 'text' : 'password';
      togglePassword.textContent = pwd.type === 'password' ? '👁️' : '🙈';
    });
  }

  // Toggle password confirm (en página de registro)
  const togglePasswordConfirm = document.getElementById('togglePasswordConfirm');
  if (togglePasswordConfirm) {
    togglePasswordConfirm.addEventListener('click', () => {
      const pwd = document.getElementById('passwordConfirm');
      pwd.type = pwd.type === 'password' ? 'text' : 'password';
      togglePasswordConfirm.textContent = pwd.type === 'password' ? '👁️' : '🙈';
    });
  }
});

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errorEl = document.getElementById('loginError');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  setLoading(btn, true);
  errorEl.style.display = 'none';

  withSupabase(async (db) => {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = 'Correo o contraseña incorrectos. Verifica tus credenciales.';
      errorEl.style.display = 'block';
      setLoading(btn, false);
      return;
    }
    window.location.href = 'dashboard.html';
  });
}

async function handleLogout() {
  withSupabase(async (db) => {
    await db.auth.signOut();
    window.location.href = 'index.html';
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
  const rol = document.getElementById('rol').value;

  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  // Validaciones
  if (password !== passwordConfirm) {
    errorEl.textContent = 'Las contraseñas no coinciden.';
    errorEl.style.display = 'block';
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errorEl.style.display = 'block';
    return;
  }

  if (!rol) {
    errorEl.textContent = 'Por favor selecciona un rol.';
    errorEl.style.display = 'block';
    return;
  }

  setLoading(btn, true);

  withSupabase(async (db) => {
    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre: nombre
        }
      }
    });

    if (authError) {
      errorEl.textContent = authError.message === 'User already registered' 
        ? 'Este correo ya está registrado.' 
        : 'Error al crear la cuenta: ' + authError.message;
      errorEl.style.display = 'block';
      setLoading(btn, false);
      return;
    }

    // Insertar en tabla de usuarios
    const { error: dbError } = await db
      .from('usuarios')
      .insert({
        id: authData.user.id,
        correo: email,
        nombre: nombre,
        rol: rol
      });

    if (dbError) {
      console.error('Error al guardar perfil:', dbError);
      errorEl.textContent = 'Cuenta creada pero hubo un error al guardar el perfil.';
      errorEl.style.display = 'block';
      setLoading(btn, false);
      return;
    }

    // Éxito
    successEl.textContent = '¡Cuenta creada exitosamente! Redirigiendo...';
    successEl.style.display = 'block';
    
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 2000);
  });
}

// ============================================================
// SIDEBAR MÓVIL
// ============================================================
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const menuToggle = document.getElementById('menuToggle');
  const sidebarClose = document.getElementById('sidebarClose');

  if (!sidebar) return;

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  if (menuToggle) menuToggle.addEventListener('click', openSidebar);
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
}

// ============================================================
// UTILIDADES
// ============================================================
function setLoading(btn, loading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text) text.style.display = loading ? 'none' : '';
  if (loader) loader.style.display = loading ? 'inline' : 'none';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatFecha(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function labelArea(area) {
  const map = {
    Produccion: 'Producción',
    Envios: 'Envíos',
    Entrega: 'Entrega',
    Atencion_cliente: 'Atención al Cliente'
  };
  return map[area] || area;
}

function labelTipo(tipo) {
  const map = {
    Peticion: 'Petición',
    Queja: 'Queja',
    Reclamo: 'Reclamo',
    Sugerencia: 'Sugerencia'
  };
  return map[tipo] || tipo;
}

function labelEstado(estado) {
  const map = {
    Pendiente: 'Pendiente',
    En_proceso: 'En Proceso',
    Resuelto: 'Resuelto'
  };
  return map[estado] || estado;
}

function badgeEstado(estado) {
  return `<span class="badge badge-${estado}">${labelEstado(estado)}</span>`;
}

function badgeTipo(tipo) {
  return `<span class="badge badge-${tipo}">${labelTipo(tipo)}</span>`;
}

function getCurrentUser() {
  return new Promise((resolve) => {
    withSupabase(async (db) => {
      const { data: { session } } = await db.auth.getSession();
      resolve(session ? session.user : null);
    });
  });
}

function showAlert(elementId, type, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// ============================================================
// DARK MODE
// ============================================================
function initDarkMode() {
  const saved = localStorage.getItem('darkMode');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Inject toggle button into topbar-actions
  const actions = document.querySelector('.topbar-actions');
  if (!actions) return;

  const btn = document.createElement('button');
  btn.id = 'darkToggle';
  btn.className = 'btn-dark-toggle';
  btn.title = 'Cambiar modo oscuro / claro';
  btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';

  btn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('darkMode', 'light');
      btn.textContent = '🌙';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('darkMode', 'dark');
      btn.textContent = '☀️';
    }
  });

  actions.insertBefore(btn, actions.firstChild);
}
