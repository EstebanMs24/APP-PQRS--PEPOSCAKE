// ============================================================
// REPORTES.JS - Estadísticas y reportes
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  withSupabase(async (db) => {
    await generarReporte(db, null, null);

    document.getElementById('btnGenerarReporte').addEventListener('click', async () => {
      const btn = document.getElementById('btnGenerarReporte');
      const desde = document.getElementById('reporteDesde').value || null;
      const hasta = document.getElementById('reporteHasta').value || null;
      btn.disabled = true;
      btn.textContent = '⏳ Generando...';
      await generarReporte(db, desde, hasta);
      btn.disabled = false;
      btn.textContent = '✅ Reporte generado';
      setTimeout(() => { btn.textContent = '📊 Generar'; }, 2000);
    });

    document.getElementById('btnReporteTodo').addEventListener('click', async () => {
      const btn = document.getElementById('btnReporteTodo');
      document.getElementById('reporteDesde').value = '';
      document.getElementById('reporteHasta').value = '';
      btn.disabled = true;
      btn.textContent = '⏳ Cargando...';
      await generarReporte(db, null, null);
      btn.disabled = false;
      btn.textContent = '✅ Todo cargado';
      setTimeout(() => { btn.textContent = 'Ver Todo'; }, 2000);
    });

    document.getElementById('btnExportExcel').addEventListener('click', async () => {
      const desde = document.getElementById('reporteDesde').value || null;
      const hasta = document.getElementById('reporteHasta').value || null;
      let query = db.from('pqrs').select('*').eq('eliminado', false).order('fecha_registro', { ascending: false });
      if (desde) query = query.gte('fecha_registro', desde + 'T00:00:00');
      if (hasta) query = query.lte('fecha_registro', hasta + 'T23:59:59');
      const { data } = await query;
      if (typeof exportToExcel === 'function') {
        exportToExcel(data || [], 'Reporte_PQRS_PeposCake');
      }
    });
  });
});

async function generarReporte(db, desde, hasta) {
  let query = db.from('pqrs').select('*').eq('eliminado', false);
  if (desde) query = query.gte('fecha_registro', desde + 'T00:00:00');
  if (hasta) query = query.lte('fecha_registro', hasta + 'T23:59:59');

  const { data, error } = await query;
  if (error || !data) return;

  // KPIs
  const total    = data.length;
  const pendiente = data.filter(d => d.estado === 'Pendiente').length;
  const proceso   = data.filter(d => d.estado === 'En_proceso').length;
  const resuelto  = data.filter(d => d.estado === 'Resuelto').length;
  const tasa      = total > 0 ? Math.round((resuelto / total) * 100) : 0;

  setText('rTotal', total);
  setText('rPendiente', pendiente);
  setText('rProceso', proceso);
  setText('rResuelto', resuelto);
  setText('rTasa', tasa + '%');

  // Gráfico por área
  const porArea = groupBy(data, 'area_responsable');
  renderBarChart('chartReporteArea', porArea, total, {
    Produccion: 'Producción',
    Envios: 'Envíos',
    Entrega: 'Entrega',
    Atencion_cliente: 'Atención al Cliente'
  });

  // Gráfico por tipo
  const porTipo = groupBy(data, 'tipo_solicitud');
  renderBarChart('chartReporteTipo', porTipo, total, {
    Peticion: 'Petición',
    Queja: 'Queja',
    Reclamo: 'Reclamo',
    Sugerencia: 'Sugerencia'
  });

  // PQRS por mes
  const porMes = {};
  data.forEach(row => {
    const d = new Date(row.fecha_registro);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!porMes[key]) porMes[key] = { total: 0, Pendiente: 0, En_proceso: 0, Resuelto: 0 };
    porMes[key].total++;
    porMes[key][row.estado] = (porMes[key][row.estado] || 0) + 1;
  });

  const mesSorted = Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0]));
  const maxMes = mesSorted.reduce((max, [, v]) => Math.max(max, v.total), 1);

  // Gráfico de mes
  const chartMes = document.getElementById('chartReporteMes');
  if (chartMes) {
    chartMes.innerHTML = mesSorted.map(([mes, v]) => {
      const pct = Math.round((v.total / maxMes) * 100);
      const [year, month] = mes.split('-');
      const label = new Date(year, month - 1).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
      return `
        <div class="bar-item">
          <span class="bar-label">${label}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%">
              <span class="bar-value">${v.total}</span>
            </div>
          </div>
          <span class="bar-count">${v.total}</span>
        </div>
      `;
    }).join('') || '<p class="text-muted text-center">Sin datos</p>';
  }

  // Tabla mensual
  const tbody = document.getElementById('tbodyMeses');
  if (tbody) {
    if (mesSorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Sin datos en el período seleccionado.</td></tr>';
    } else {
      tbody.innerHTML = mesSorted.reverse().map(([mes, v]) => {
        const [year, month] = mes.split('-');
        const label = new Date(year, month - 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        const tasaMes = v.total > 0 ? Math.round((v.Resuelto / v.total) * 100) : 0;
        return `
          <tr>
            <td style="text-transform:capitalize">${label}</td>
            <td><strong>${v.total}</strong></td>
            <td><span class="badge badge-Pendiente">${v.Pendiente || 0}</span></td>
            <td><span class="badge badge-En_proceso">${v.En_proceso || 0}</span></td>
            <td><span class="badge badge-Resuelto">${v.Resuelto || 0}</span></td>
            <td>${tasaMes}%</td>
          </tr>
        `;
      }).join('');
    }
  }
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const val = item[key] || 'Sin clasificar';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

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
        <span class="bar-label">${label}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%">
            <span class="bar-value">${count}</span>
          </div>
        </div>
        <span class="bar-count">${count}</span>
      </div>
    `;
  }).join('') || '<p class="text-muted text-center">Sin datos</p>';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
