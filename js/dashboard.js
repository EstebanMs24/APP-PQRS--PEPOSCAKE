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
  Utils.renderBarChart('chartArea', porArea, total, {
    Produccion: 'Producción',
    Envios: 'Envíos',
    Entrega: 'Entrega',
    Atencion_cliente: 'Atención al Cliente'
  });

  // Gráfico por tipo
  const porTipo = Utils.groupBy(data, 'tipo_solicitud');
  Utils.renderBarChart('chartTipo', porTipo, total, {
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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function cargarTendencia(db) {
  const container = document.getElementById('chartTendencia');
  if (!container) return;

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

  container.innerHTML = Utils.renderTrendSVG(meses);
}
