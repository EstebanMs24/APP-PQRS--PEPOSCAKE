// ============================================================
// DASHBOARD.JS - Panel principal con estadísticas
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  withAdmin(async (db) => {
    await cargarEstadisticas(db);
    await cargarCasosRecientes(db);
    await cargarPrioritarios(db);

    // Realtime: recargar estadísticas ante cualquier cambio en pqrs
    try {
      db.channel('dashboard_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pqrs' }, () => {
          cargarEstadisticas(db);
          cargarCasosRecientes(db);
          cargarPrioritarios(db);
        })
        .subscribe();
    } catch { Utils.showToast('La actualización automática no está disponible. Recarga para ver cambios.','info'); }
  });
});


let dashboardSummary=null;
async function cargarEstadisticas(db) {
 const {data,error}=await db.rpc('resumen_pqrs');
 if(error||!data){ dashboardSummary=null;['statTotal','statPendiente','statProceso','statResuelto','statSlaVencido','statPorVencer','statEliminado'].forEach(id=>setText(id,'?'));Utils.showToast('No se pudieron cargar los indicadores. Recarga para reintentar.','error');return; }
 dashboardSummary=data;
 for(const [id,key] of [['statTotal','total'],['statPendiente','pendiente'],['statProceso','proceso'],['statResuelto','resuelto'],['statSlaVencido','vencido'],['statPorVencer','por_vencer'],['statEliminado','archivados']])setText(id,data[key]);
 Utils.renderBarChart('chartArea',data.areas,data.total,{Produccion:'Producción',Envios:'Envíos',Entrega:'Entrega',Atencion_cliente:'Atención al cliente'});
 Utils.renderBarChart('chartTipo',data.tipos,data.total,{Peticion:'Petición',Queja:'Queja',Reclamo:'Reclamo',Sugerencia:'Sugerencia'});
 await cargarTendencia(db);
}

async function cargarCasosRecientes(db) {
  const tbody = document.getElementById('tbodyRecientes');
  if (!tbody) return;

  const { data, error } = await db
    .from('pqrs')
    .select('id, numero_caso, nombre_cliente, tipo_solicitud, area_responsable, estado, fecha_registro')
    .or('eliminado.is.null,eliminado.eq.false')
    .order('fecha_registro', { ascending: false })
    .limit(10);

  if (error || !data) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Error al cargar datos.</td></tr>';
    return;
  }
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-mascot">
        <img src="img/mascota-pepo.png?v=15" alt="Mascota Pepo's Cake" />
        <span class="empty-title">Todo tranquilo por ahora</span>
        <p>Aún no hay PQRS registrados. Cuando llegue el primero, aparecerá aquí.</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td><strong>${Utils.escapeHtml(row.numero_caso)}</strong></td>
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

  if(!dashboardSummary){container.textContent='No se pudo cargar la tendencia.';return;}
  meses.forEach(m=>m.total=dashboardSummary.meses[m.key]||0);
  container.innerHTML = Utils.renderTrendSVG(meses);
}

async function cargarPrioritarios(db) {
 const container=document.getElementById('casosPrioritarios');
 const {data,error}=await db.from('pqrs').select('id,numero_caso,estado,tipo_solicitud,fecha_registro').or('eliminado.is.null,eliminado.eq.false').eq('prioridad','Alta').or('estado.eq.Pendiente,estado.eq.En_proceso').order('fecha_registro',{ascending:true}).limit(5);
 if(error){container.textContent='No se pudo cargar la atención prioritaria.';return;}
 if(!data?.length){container.textContent='No hay solicitudes abiertas de prioridad alta.';return;}
 container.innerHTML=data.map(row=>`<a href="detalle-pqrs.html?id=${row.id}"><strong>${Utils.escapeHtml(row.numero_caso)}</strong>${Utils.badgeEstado(row.estado)}${Utils.renderSlaBadge(row)}<span>Revisar caso →</span></a>`).join('');
}
