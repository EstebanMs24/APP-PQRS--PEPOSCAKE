// ============================================================
// SUPABASE CLIENT - Pepo's Cake PQRS
// ⚠️  IMPORTANTE: Reemplaza estas variables con tus credenciales
// Panel Supabase → Settings → API
// ============================================================

const SUPABASE_URL = 'https://paskcxvaonsztsbqtesr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhc2tjeHZhb25zenRzYnF0ZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MjkyNjksImV4cCI6MjA4ODUwNTI2OX0.-P3MYkZYmBmRS99m4wudYWmbR3greMcno4j0H4qJOeg';

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
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (window.supabase) {
      clearInterval(interval);
      callback(getSupabaseClient());
    } else if (attempts >= 200) { // 10 segundos máximo
      clearInterval(interval);
      console.error('No se pudo conectar con Supabase. Verifica tu conexión a internet.');
      // Mostrar error visible al usuario si hay un contenedor de error disponible
      const errEl = document.getElementById('loginError') || document.getElementById('registroError');
      if (errEl) {
        errEl.textContent = 'Error de conexión. Verifica tu internet e intenta de nuevo.';
        errEl.style.display = 'block';
      }
    }
  }, 50);
}
