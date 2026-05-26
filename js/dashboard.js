// ============================================================
// DASHBOARD.JS - Panel principal con estadísticas
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  withSupabase(async (db) => {
    await cargarEstadisticas(db);
    await cargarCasosRecientes(db);
    await cargarTendencia(db);

    // Realtime: recargar estadísticas ante cualquier cambio en pqrs
    try {
      db.channel('dashboard_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pqrs' }, () => {
          cargarEstadisticas(db);
          cargarCasosRecientes(db);
        })
        .subscribe();
    } catch (e) { /* realtime opcional */ }
  });
});

async function cargarEstadisticas(db) {
  const { data, error } = await db.from('pqrs')
    .select('estado, area_responsable, tipo_solicitud, fecha_registro')
    .neq('eliminado', true);

  if (error || !data) { console.error('Error stats:', error); return; }

  const total = data.length;
  const pendiente = data.filter(d => d.estado === 'Pendiente').length;
  const proceso = data.filter(d => d.estado === 'En_proceso').length;
  const resuelto = data.filter(d => d.estado === 'Resuelto').length;

  setText('statTotal', total);
  setText('statPendiente', pendiente);
  setText('statProceso', proceso);
  setText('statResuelto', resuelto);

  // SLA Vencido: activos cuyo plazo de horas ha expirado
  const ahora = Date.now();
  const slaVencidos = data.filter(d => {
    if (d.estado === 'Resuelto') return false;
    const horas = CONFIG.SLA_HORAS[d.tipo_solicitud] || 120;
    const msTranscurridos = ahora - new Date(d.fecha_registro).getTime();
    const horasTranscurridas = msTranscurridos / 3600000;
    return horasTranscurridas > horas;
  }).length;
  setText('statSlaVencido', slaVencidos);

  // Contar eliminados
  const { count: countEliminados, error: errCount } = await db
    .from('pqrs')
    .select('id', { count: 'exact', head: true })
    .eq('eliminado', true);
  setText('statEliminado', errCount ? '?' : (countEliminados ?? 0));

  // Gráfico por área
  const porArea = Utils.groupBy(data, 'area_responsable');
  renderBarChart('chartArea', porArea, total, {
    Produccion: 'Producción',
    Envios: 'Envíos',
    Entrega: 'Entrega',
    Atencion_cliente: 'Atención al Cliente'
  });

  // Gráfico por tipo
  const porTipo = Utils.groupBy(data, 'tipo_solicitud');
  renderBarChart('chartTipo', porTipo, total, {
    Peticion: 'Petición',
    Queja: 'Queja',
    Reclamo: 'Reclamo',
    Sugerencia: 'Sugerencia'
  });
}

async function cargarCasosRecientes(db) {
  const tbody = document.getElementById('tbodyRecientes');
  if (!tbody) return;

  const { data, error } = await db
    .from('pqrs')
    .select('id, numero_caso, nombre_cliente, tipo_solicitud, area_responsable, estado, fecha_registro')
    .neq('eliminado', true)
    .order('fecha_registro', { ascending: false })
    .limit(10);

  if (error || !data) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Error al cargar datos.</td></tr>';
    return;
  }
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay PQRS registrados aún.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td><strong>${row.numero_caso}</strong></td>
      <td>${Utils.escapeHtml(row.nombre_cliente)}</td>
      <td>${Utils.badgeTipo(row.tipo_solicitud)}</td>
      <td>${Utils.labelArea(row.area_responsable)}</td>
      <td>${Utils.badgeEstado(row.estado)}</td>
      <td>${Utils.formatFecha(row.fecha_registro)}</td>
      <td>
        <a href="detalle-pqrs.html?id=${row.id}" class="btn btn-outline btn-sm">Ver</a>
      </td>
    </tr>
  `).join('');
}

// ============================================================
// UTILIDADES DE DASHBOARD
// ============================================================
function renderBarChart(containerId, data, total, labelMap) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

  container.innerHTML = sorted.map(([key, count]) => {
    const pct = maxVal > 0 ? Math.round((count / maxVal) * 100) : 0;
    const label = (labelMap && labelMap[key]) ? labelMap[key] : key;
    return `
      <div class="bar-item">
        <span class="bar-label">${Utils.escapeHtml(label)}</span>
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
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ============================================================
// TREND CHART — últimos 6 meses (SVG inline)
// ============================================================
async function cargarTendencia(db) {
  const container = document.getElementById('chartTendencia');
  if (!container) return;

  // Calcular rango: últimos 6 meses completos + el mes actual
  const hoy = new Date();
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
      total: 0
    });
  }

  const primerMes = meses[0].key + '-01';
  const { data, error } = await db
    .from('pqrs')
    .select('fecha_registro')
    .neq('eliminado', true)
    .gte('fecha_registro', primerMes + 'T00:00:00');

  if (error || !data) {
    container.innerHTML = '<p class="text-muted text-center">Sin datos disponibles.</p>';
    return;
  }

  data.forEach(row => {
    const d = new Date(row.fecha_registro);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mes = meses.find(m => m.key === key);
    if (mes) mes.total++;
  });

  container.innerHTML = renderTrendSVG(meses);
}

function renderTrendSVG(meses) {
  const W = 600, H = 180;
  const padL = 30, padR = 20, padT = 30, padB = 35;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...meses.map(m => m.total), 1);
  const n = meses.length;

  // X positions — evenly spaced
  const xs = meses.map((_, i) => padL + (i / (n - 1)) * chartW);
  const ys = meses.map(m => padT + chartH - (m.total / maxVal) * chartH);

  // Polyline points
  const linePoints = xs.map((x, i) => `${x},${ys[i]}`).join(' ');

  // Area path (close polygon below)
  const areaPath = `M${xs[0]},${padT + chartH} ` +
    xs.map((x, i) => `L${x},${ys[i]}`).join(' ') +
    ` L${xs[n - 1]},${padT + chartH} Z`;

  // Grid lines (3 levels)
  const gridLines = [0.25, 0.5, 0.75, 1].map(frac => {
    const y = padT + chartH - frac * chartH;
    const label = Math.round(frac * maxVal);
    return `<line class="trend-grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>
            <text x="${padL - 4}" y="${y + 4}" text-anchor="end" class="trend-month-label">${label}</text>`;
  }).join('');

  // Dots & value labels
  const dots = meses.map((m, i) => `
    <circle class="trend-dot" cx="${xs[i]}" cy="${ys[i]}" r="5"/>
    <text class="trend-dot-label" x="${xs[i]}" y="${ys[i] - 10}" text-anchor="middle">${m.total > 0 ? m.total : ''}</text>
  `).join('');

  // Month labels
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
}
