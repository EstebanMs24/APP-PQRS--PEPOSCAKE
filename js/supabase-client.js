// ============================================================
// SUPABASE CLIENT - Pepo's Cake PQRS
// Reemplaza las variables con tus credenciales de Supabase
// ============================================================

// ⚠️  IMPORTANTE: Reemplaza estos valores con los de tu proyecto Supabase
// Panel Supabase → Settings → API
const SUPABASE_URL = 'https://TU_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_PUBLIC_KEY';

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

// Espera a que Supabase SDK esté disponible y ejecuta callback
function withSupabase(callback) {
  if (window.supabase) {
    callback(getSupabaseClient());
    return;
  }
  const interval = setInterval(() => {
    if (window.supabase) {
      clearInterval(interval);
      callback(getSupabaseClient());
    }
  }, 50);
}
