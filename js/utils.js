// ============================================================
// UTILS.JS - Funciones utilitarias compartidas
// ============================================================

const Utils = {
  // Fechas y formatos
  formatFecha(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  formatFechaCorta(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  },

  formatHora(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit'
    });
  },

  // HTML escaping
  escapeHtml(str) {
    if (!str) return '—';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Strings
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  truncate(str, length = 50) {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '…' : str;
  },

  // Arrays
  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const val = item[key] || 'Sin clasificar';
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  },

  // Labels (usando config.js para mantener sincronización)
  labelArea(area) {
    return getLabelArea(area);
  },

  labelTipo(tipo) {
    return getLabelTipo(tipo);
  },

  labelEstado(estado) {
    return getLabelEstado(estado);
  },

  // Badges HTML
  badgeEstado(estado) {
    return `<span class="badge badge-${estado}">${Utils.labelEstado(estado)}</span>`;
  },

  badgeTipo(tipo) {
    return `<span class="badge badge-${tipo}">${Utils.labelTipo(tipo)}</span>`;
  },

  badgeArea(area) {
    return `<span class="badge badge-area">${Utils.labelArea(area)}</span>`;
  },

  // Notificaciones
  showToast(mensaje, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `<i class="bi bi-${tipo === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${mensaje}`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  showAlert(mensaje, tipo = 'info') {
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${tipo}`;
    alertEl.textContent = mensaje;
    const container = document.querySelector('.page-body') || document.body;
    container.insertBefore(alertEl, container.firstChild);
    setTimeout(() => alertEl.remove(), 5000);
  },

  // Charts y visualización
  renderDonut(canvasId, valor, total, color) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    const pct = total > 0 ? (valor / total) : 0;
    const r = 28, cx = 32, cy = 32;
    const circum = 2 * Math.PI * r;
    const dash = circum * pct;
    el.innerHTML = `
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
                stroke="var(--color-border)" stroke-width="6"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
                stroke="${color}" stroke-width="6"
                stroke-dasharray="${dash.toFixed(1)} ${circum.toFixed(1)}"
                stroke-dashoffset="${circum * 0.25}"
                stroke-linecap="round"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle"
              font-size="13" font-weight="600" fill="var(--color-text)">
          ${Math.round(pct * 100)}%
        </text>
      </svg>
    `;
  },

  // Utilidades
  generarNumeroCaso() {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(5, '0');
    return `PC-${año}-${random}`;
  },

  calcularDiasTranscurridos(fechaInicio) {
    const inicio = new Date(fechaInicio);
    const ahora = new Date();
    const diffMs = ahora - inicio;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  },

  calcularDiasRestantes(fechaLimite) {
    const limite = new Date(fechaLimite);
    const ahora = new Date();
    const diffMs = limite - ahora;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  },

  // Conversiones
  toJSON(obj) {
    return JSON.stringify(obj);
  },

  fromJSON(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }
};
