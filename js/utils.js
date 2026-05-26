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

  renderBarChart(containerId, data, total, labelMap) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

    container.innerHTML = sorted.map(([key, count]) => {
      const pct = maxVal > 0 ? Math.round((count / maxVal) * 100) : 0;
      const label = (labelMap && labelMap[key]) ? labelMap[key] : key;
      return `
        <div class="bar-item">
          <span class="bar-label">${this.escapeHtml(label)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%">
              <span class="bar-value">${count}</span>
            </div>
          </div>
          <span class="bar-count">${count}</span>
        </div>
      `;
    }).join('');

    if (sorted.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">Sin datos</p>';
    }
  },

  renderTrendSVG(meses) {
    const W = 600, H = 180;
    const padL = 30, padR = 20, padT = 30, padB = 35;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const maxVal = Math.max(...meses.map(m => m.total), 1);
    const n = meses.length;

    const xs = meses.map((_, i) => padL + (i / (n - 1)) * chartW);
    const ys = meses.map(m => padT + chartH - (m.total / maxVal) * chartH);

    const linePoints = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
    const areaPath = `M${xs[0]},${padT + chartH} ` +
      xs.map((x, i) => `L${x},${ys[i]}`).join(' ') +
      ` L${xs[n - 1]},${padT + chartH} Z`;

    const gridLines = [0.25, 0.5, 0.75, 1].map(frac => {
      const y = padT + chartH - frac * chartH;
      const label = Math.round(frac * maxVal);
      return `<line class="trend-grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>
              <text x="${padL - 4}" y="${y + 4}" text-anchor="end" class="trend-month-label">${label}</text>`;
    }).join('');

    const dots = meses.map((m, i) => `
      <circle class="trend-dot" cx="${xs[i]}" cy="${ys[i]}" r="5"/>
      <text class="trend-dot-label" x="${xs[i]}" y="${ys[i] - 10}" text-anchor="middle">${m.total > 0 ? m.total : ''}</text>
    `).join('');

    const monthLabels = meses.map((m, i) => `
      <text class="trend-month-label" x="${xs[i]}" y="${H - 4}" text-anchor="middle">${m.label}</text>
    `).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%; max-width:${W}px;">
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4ECDC4" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#4ECDC4" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <path class="trend-area" d="${areaPath}"/>
        <polyline class="trend-line" points="${linePoints}"/>
        ${dots}
        ${monthLabels}
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
