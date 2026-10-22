// Authorization is verified remotely; RLS remains the authority for every operation.
const PROTECTED_PAGES = ['dashboard', 'nuevo-pqrs', 'lista-pqrs', 'detalle-pqrs', 'reportes', 'usuarios'];
window.authReady = new Promise(resolve => { window.resolveAuth = resolve; });
async function usuarioActivo(db, id) {
  const { data, error } = await db.from('usuarios').select('id,nombre,correo,rol,activo').eq('id', id).single();
  if (error || !data || data.activo !== true || data.rol !== 'admin') return false;
  window.currentUser = data; window.currentUserRol = data.rol;
  return true;
}
function getCurrentUser() { return window.currentUser || null; }
async function requireAdmin(db) {
  const { data, error } = await db.auth.getUser();
  if (error || !data?.user || !await usuarioActivo(db, data.user.id)) throw new Error('Acceso administrativo no autorizado.');
  return window.currentUser;
}
async function withAdmin(callback) {
  const allowed = await window.authReady;
  if (!allowed) return;
  return withSupabase(async db => { await requireAdmin(db); return callback(db); });
}
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('togglePassword')?.addEventListener('click', togglePasswordVisibility);
  const page = extraerNombrePagina();
  try {
    const db = await supabaseReady();
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    const allowed = !!data.session && await usuarioActivo(db, data.session.user.id);
    if (PROTECTED_PAGES.includes(page) && !allowed) {
      window.location.replace('index.html?acceso=1'); window.resolveAuth(false); return;
    }
    if (page === 'index' && allowed) { window.location.replace('dashboard.html'); return; }
    if (allowed) {
      const name = document.getElementById('userName'), role = document.getElementById('userRole');
      if (name) name.textContent = window.currentUser.nombre;
      if (role) role.textContent = 'Administrador';
      updateRoleBasedElements();
    }
    document.documentElement.classList.remove('auth-pending');
    window.resolveAuth(allowed);
    initSidebar(); initDarkMode();
    db.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' && PROTECTED_PAGES.includes(page)) window.location.replace('index.html');
    });
    if (page === 'index' && new URLSearchParams(location.search).has('acceso')) mostrarError(document.getElementById('loginError'), 'Se requiere una cuenta administrativa activa.');
  } catch {
    window.resolveAuth(false);
    document.documentElement.classList.remove('auth-pending');
    mostrarError(document.getElementById('loginError'), 'No se pudo verificar el acceso. Intenta de nuevo.');
    if (PROTECTED_PAGES.includes(page)) window.location.replace('index.html?acceso=1');
  }
});
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn'), errorEl = document.getElementById('loginError');
  if (btn.disabled) return;
  setLoading(btn, true); errorEl.style.display = 'none';
  try {
    const db = await supabaseReady();
    const { data, error } = await db.auth.signInWithPassword({ email: document.getElementById('email').value.trim(), password: document.getElementById('password').value });
    if (error) throw new Error('Correo o contraseña incorrectos, o servicio no disponible.');
    if (!await usuarioActivo(db, data.user.id)) {
      await db.auth.signOut(); throw new Error('Se requiere una cuenta administrativa activa. Contacta al responsable del sistema.');
    }
    window.location.assign('dashboard.html');
  } catch (error) { mostrarError(errorEl, error.message); }
  finally { setLoading(btn, false); }
}
async function handleLogout() {
  try {
    const db = await supabaseReady(); const { error } = await db.auth.signOut();
    if (error) throw error;
    window.currentUser = null; window.currentUserRol = null;
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USUARIO);
    window.location.replace('index.html');
  } catch { Utils.showToast('No se pudo cerrar la sesión. Intenta de nuevo.', 'error'); }
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
  const mobileMenu=window.matchMedia('(max-width:860px)');
  sidebar.inert=mobileMenu.matches;
  mobileMenu.addEventListener('change',()=>{sidebar.inert=mobileMenu.matches&&!sidebar.classList.contains('open');});

  function abrirSidebar() {
    sidebar.inert=false;document.querySelector('.main-content').inert=true;
    sidebar.classList.add('open'); menuToggle?.setAttribute('aria-expanded','true'); sidebarClose?.focus();
    overlay?.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function cerrarSidebar() {
    document.querySelector('.main-content').inert=false;sidebar.inert=mobileMenu.matches;
    sidebar.classList.remove('open'); menuToggle?.setAttribute('aria-expanded','false');
    overlay?.classList.remove('visible');
    document.body.style.overflow = '';
  }

  menuToggle?.addEventListener('click', abrirSidebar);
  sidebarClose?.addEventListener('click', cerrarSidebar);
  overlay?.addEventListener('click', cerrarSidebar);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sidebar.classList.contains('open')){cerrarSidebar();menuToggle?.focus();}});

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
  btn.title = 'Alternar modo oscuro'; btn.setAttribute('aria-label','Alternar modo oscuro');
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
