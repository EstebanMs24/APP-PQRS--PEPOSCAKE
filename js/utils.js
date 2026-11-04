// ============================================================
// UTILS.JS - Funciones utilitarias compartidas
// ============================================================

const Utils = {
  fechaBogota(iso) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso)); },
  // Fechas y formatos
  formatFecha(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  formatFechaCorta(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota', day: '2-digit', month: 'long', year: 'numeric'
    });
  },

  formatHora(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit'
    });
  },

  // HTML escaping
  escapeHtml(str) {
    if (str === null || str === undefined || str === '') return '—';
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

  labelPrioridad(prioridad) {
    return getLabelPrioridad(prioridad);
  },

  // Badges HTML
  badgeEstado(estado) {
    return `<span class="badge badge-${Utils.escapeHtml(estado)}">${Utils.escapeHtml(Utils.labelEstado(estado))}</span>`;
  },

  badgeTipo(tipo) {
    return `<span class="badge badge-${Utils.escapeHtml(tipo)}">${Utils.escapeHtml(Utils.labelTipo(tipo))}</span>`;
  },

  badgeArea(area) {
    return `<span class="badge badge-area">${Utils.escapeHtml(Utils.labelArea(area))}</span>`;
  },

  badgePrioridad(prioridad) {
    const p = prioridad || 'Media';
    return `<span class="badge badge-prio-${Utils.escapeHtml(p)}">${Utils.labelPrioridad(p)}</span>`;
  },

  // Notificaciones — Toast premium (usa estructura .toast-container/.toast del CSS)
  _toastContainer() {
    let cont = document.querySelector('.toast-container');
    if (!cont) {
      cont = document.createElement('div');
      cont.className = 'toast-container'; cont.setAttribute('role','status'); cont.setAttribute('aria-live','polite');
      document.body.appendChild(cont);
    }
    return cont;
  },

  showToast(mensaje, tipo = 'success', opciones = {}) {
    const cont = this._toastContainer();
    const iconos = {
      success: 'bi-check-circle-fill',
      error: 'bi-x-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      info: 'bi-info-circle-fill'
    };
    const titulosDefault = {
      success: '¡Listo!', error: 'Error', warning: 'Atención', info: 'Información'
    };
    const titulo = opciones.title || titulosDefault[tipo] || titulosDefault.info;
    const toast = document.createElement('div');
    toast.className = `toast toast-${Utils.escapeHtml(tipo)}`;
    toast.innerHTML = `
      <span class="toast-icon"><i class="bi ${iconos[tipo] || iconos.info}"></i></span>
      <div class="toast-content">
        <span class="toast-title">${this.escapeHtml(titulo)}</span>
        <span class="toast-message">${this.escapeHtml(mensaje)}</span>
      </div>
      <button class="toast-close" type="button" aria-label="Cerrar"><i class="bi bi-x-lg"></i></button>
    `;
    cont.appendChild(toast);

    const cerrar = () => {
      toast.classList.add('hidden');
      setTimeout(() => toast.remove(), 320);
    };
    toast.querySelector('.toast-close').addEventListener('click', cerrar);
    const duracion = opciones.duration != null ? opciones.duration : 4000;
    if (duracion > 0) setTimeout(cerrar, duracion);
    return toast;
  },

  showAlert(mensaje, tipo = 'info') {
    return this.showToast(mensaje, tipo);
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

  // Paleta semántica para columnas (distinta por categoría)
  CHART_PALETTE: ['#7DCFB6', '#F0C75A', '#E89098', '#6FA8DC', '#9B8BD4', '#5AB89A'],

  renderBarChart(containerId, data, total, labelMap = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const keys = [...new Set([...Object.keys(labelMap), ...Object.keys(data || {})])];
    if (!(total > 0)) {
      container.innerHTML = '<div class="chart-empty"><i class="bi bi-bar-chart" aria-hidden="true"></i><strong>Aún no hay datos para mostrar</strong><span>Las solicitudes aparecerán aquí cuando estén disponibles.</span></div>';
      return;
    }
    container.innerHTML = '<ul class="distribution-chart">' + keys.map((key, i) => {
      const count = Math.max(0, Number(data?.[key]) || 0);
      const percent = Math.min(100, count / total * 100);
      const label = this.escapeHtml(labelMap[key] || key);
      const color = ['#23765f','#b47b30','#6586aa','#a56b81'][i % 4];
      return `<li class="distribution-row" style="--chart-color:${color}"><div class="distribution-label"><span>${label}</span><span><strong>${count}</strong><small>${percent.toLocaleString('es-CO', {maximumFractionDigits:1})}%</small></span></div><div class="distribution-track" aria-hidden="true"><span style="width:${percent}%"></span></div></li>`;
    }).join('') + '</ul><p class="chart-footnote">Base: ' + Number(total).toLocaleString('es-CO') + (total === 1 ? ' solicitud no archivada.</p>' : ' solicitudes no archivadas.</p>');
  },

  renderTrendSVG(meses) {
    if (!meses.length) return '<p class="chart-empty">Sin datos para el período seleccionado.</p>';
    const W=800, H=240, left=42, right=40, top=32, bottom=38;
    const width=W-left-right, height=H-top-bottom;
    const values=meses.map(m=>Math.max(0, Number(m.total)||0));
    const max=Math.max(...values,1), step=Math.max(1,Math.ceil(max/4)), upper=Math.ceil(max/step)*step;
    const xs=meses.map((_,i)=>left+(meses.length===1?.5:i/(meses.length-1))*width);
    const ys=values.map(v=>top+height-v/upper*height);
    const points=xs.map((x,i)=>`${x},${ys[i]}`).join(' ');
    const grid=Array.from({length:upper/step+1},(_,i)=>{
      const value=i*step,y=top+height-value/upper*height;
      return `<line class="trend-grid-line" x1="${left}" y1="${y}" x2="${W-right}" y2="${y}"/><text class="trend-month-label" x="${left-12}" y="${y+4}" text-anchor="end">${value}</text>`;
    }).join('');
    const labels=meses.map((m,i)=>`<circle class="trend-dot" cx="${xs[i]}" cy="${ys[i]}" r="5"><title>${this.escapeHtml(m.label)}: ${values[i]} solicitudes</title></circle><text class="trend-dot-label" x="${xs[i]}" y="${ys[i]-13}" text-anchor="middle">${values[i]}</text><text class="trend-month-label" x="${xs[i]}" y="${H-9}" text-anchor="middle">${this.escapeHtml(m.label)}</text>`).join('');
    const mobile='<ol class="trend-mobile">'+meses.map((m,i)=>`<li><span>${this.escapeHtml(m.label)}</span><span class="trend-mobile-track" aria-hidden="true"><span style="width:${values[i]/upper*100}%"></span></span><strong>${values[i]}</strong></li>`).join('')+'</ol>';
    const description=this.escapeHtml(meses.map((m,i)=>`${m.label}: ${values[i]}`).join('; '));
    return `<div class="chart-scroll" tabindex="0" role="region" aria-label="Tendencia mensual. En pantallas pequeñas puedes desplazar el gráfico horizontalmente."><svg class="analytics-trend" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Solicitudes por mes: ${description}"><defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#23765f" stop-opacity="0.2"/><stop offset="100%" stop-color="#23765f" stop-opacity="0.02"/></linearGradient></defs>${grid}<path class="trend-area" d="M${xs[0]},${top+height} ${xs.map((x,i)=>`L${x},${ys[i]}`).join(' ')} L${xs[xs.length-1]},${top+height} Z"/><polyline class="trend-line" points="${points}"/>${labels}</svg></div>${mobile}<details class="chart-data"><summary>Ver cifras por mes</summary><dl>${meses.map((m,i)=>`<div><dt>${this.escapeHtml(m.label)}</dt><dd>${values[i]}</dd></div>`).join('')}</dl></details>`;
  },

  // Utilidades

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

  // ---- SLA (Acuerdo de Nivel de Servicio) ----
  // Calcula el estado de SLA de un PQRS a partir de fecha_registro + tipo + estado.
  // La fecha límite = fecha_registro + CONFIG.SLA_HORAS[tipo] horas.
  // Devuelve null para Resuelto/Rechazado o si faltan datos (no aplica SLA).
  // Estados: nivel 'ok' (A tiempo), 'warning' (Por vencer, <25% del tiempo
  // restante) o 'vencido'.
  calcularEstadoSLA(pqrs) {
    if (!pqrs) return null;
    if (pqrs.estado === 'Resuelto' || pqrs.estado === 'Rechazado') return null;
    const horas = (CONFIG.SLA_HORAS && CONFIG.SLA_HORAS[pqrs.tipo_solicitud]) || null;
    if (!horas || !pqrs.fecha_registro) return null;

    const inicio = new Date(pqrs.fecha_registro).getTime();
    if (isNaN(inicio)) return null;

    const ventanaMs = horas * 3600000;
    const limite = inicio + ventanaMs;
    const msRestantes = limite - Date.now();
    const horasRestantes = msRestantes / 3600000;

    let nivel, label;
    if (msRestantes <= 0) {
      nivel = 'vencido'; label = 'Vencido';
    } else if (msRestantes < ventanaMs * 0.25) {
      nivel = 'warning'; label = 'Por vencer';
    } else {
      nivel = 'ok'; label = 'A tiempo';
    }
    return { nivel, label, limite, horasRestantes, horasTotales: horas };
  },

  // Texto compacto del tiempo (ej "2d", "5h") a partir de horas restantes.
  _slaTiempoTexto(sla) {
    const h = Math.abs(sla.horasRestantes);
    return h >= 24 ? `${Math.floor(h / 24)}d` : `${Math.max(1, Math.ceil(h))}h`;
  },

  // Badge HTML de SLA reutilizando los estilos .sla-badge existentes.
  // Resuelto/Rechazado (sin SLA) muestran un guion neutro.
  renderSlaBadge(pqrs) {
    const sla = this.calcularEstadoSLA(pqrs);
    if (!sla) return '<span class="sla-badge sla-resuelto">—</span>';

    const cfg = {
      ok:      { cls: 'sla-ok',      icon: 'bi-check-circle' },
      warning: { cls: 'sla-warning', icon: 'bi-clock-history' },
      vencido: { cls: 'sla-vencido', icon: 'bi-exclamation-triangle-fill' }
    }[sla.nivel];

    const tiempo = this._slaTiempoTexto(sla);
    const title = sla.nivel === 'vencido'
      ? `Vencido hace ${tiempo}`
      : `${sla.label} · quedan ${tiempo}`;
    return `<span class="sla-badge ${cfg.cls}" title="${title}"><i class="bi ${cfg.icon}"></i> ${sla.label} · ${tiempo}</span>`;
  },

  // Modal de confirmación propio (reemplaza confirm() nativo).
  // Devuelve una Promise<boolean>. Respeta dark mode vía tokens CSS.
  confirmModal(opts = {}) {
    const {
      title = '¿Confirmar acción?',
      message = '',
      confirmText = 'Confirmar',
      cancelText = 'Cancelar',
      variant = 'primary'   // 'primary' | 'danger'
    } = opts;

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div class="modal-header">
            <h3 id="modalTitle" class="modal-title">${this.escapeHtml(title)}</h3>
          </div>
          <div class="modal-body">${this.escapeHtml(message)}</div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" data-modal="cancel">${this.escapeHtml(cancelText)}</button>
            <button type="button" class="btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}" data-modal="ok">${this.escapeHtml(confirmText)}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));

      const previousFocus=document.activeElement; let settled=false;
      const cerrar = (resultado) => {
        if(settled)return;settled=true;previousFocus?.focus();
        overlay.classList.remove('visible');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => overlay.remove(), 200);
        resolve(resultado);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') cerrar(false);
        if(e.key==='Tab'){const buttons=overlay.querySelectorAll('button');if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[1].focus();}else if(!e.shiftKey&&document.activeElement===buttons[1]){e.preventDefault();buttons[0].focus();}}
      };

      document.addEventListener('keydown', onKey);
      overlay.querySelector('[data-modal="ok"]').addEventListener('click', () => cerrar(true));
      overlay.querySelector('[data-modal="cancel"]').addEventListener('click', () => cerrar(false));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(false); });
      setTimeout(() => overlay.querySelector('[data-modal="cancel"]').focus(), 50);
    });
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

// ============================================================
// Aliases GLOBALES de compatibilidad
// Varios módulos (detalle.js, exports.js) llaman estas funciones
// como globales. Las exponemos delegando a Utils/config.js.
// ============================================================
function formatFecha(iso)   { return Utils.formatFecha(iso); }
function labelTipo(tipo)    { return getLabelTipo(tipo); }
function labelArea(area)    { return getLabelArea(area); }
function labelEstado(est)   { return getLabelEstado(est); }
function labelPrioridad(p)  { return getLabelPrioridad(p); }
function calcularEstadoSLA(pqrs) { return Utils.calcularEstadoSLA(pqrs); }
function renderSlaBadge(pqrs)    { return Utils.renderSlaBadge(pqrs); }
function showToast(mensaje, tipo = 'success', opciones = {}) {
  return Utils.showToast(mensaje, tipo, opciones);
}
