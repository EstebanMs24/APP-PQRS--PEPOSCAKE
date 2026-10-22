// ============================================================
// SUPABASE CLIENT - Pepo's Cake PQRS
// ⚠️  IMPORTANTE: Reemplaza estas variables con tus credenciales
// Panel Supabase → Settings → API
// ============================================================

const SUPABASE_URL = 'https://kxxnyhyliqvqfnrlkaxd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eG55aHlsaXF2cWZucmxrYXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NTE5ODQsImV4cCI6MjA5NTMyNzk4NH0.u6QMRLYx0M-Ruuybem2rJjFArSaacIEqkKIP5aLJ7cI';

// Carga la librería de Supabase desde CDN (cargada en el HTML si no existe)
(function loadSupabase() {
  if (window.supabase) return;
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.async = false;
  document.head.appendChild(script);
})();

// Función auxiliar para obtener el cliente una vez cargado
function getSupabaseClient() {
  if (!window._supabaseClient) {
    if (!window.supabase) {
      console.error('Supabase SDK no cargado todavía.');
      return null;
    }
    window._supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return window._supabaseClient;
}


// One shared promise; callers can await SDK loading and asynchronous failures.
let sdkPromise;
function supabaseReady() {
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      if (window.supabase) { resolve(getSupabaseClient()); return; }
      if (++attempts >= 200) { sdkPromise = null; reject(new Error('No se pudo cargar la conexión. Revisa tu internet.')); return; }
      setTimeout(check, 50);
    };
    check();
  });
  return sdkPromise;
}
async function withSupabase(callback) {
  try { return await callback(await supabaseReady()); }
  catch {
    if (typeof Utils !== 'undefined') Utils.showToast('La operación no pudo completarse. Revisa la conexión e intenta de nuevo.', 'error');
    return undefined;
  }
}
