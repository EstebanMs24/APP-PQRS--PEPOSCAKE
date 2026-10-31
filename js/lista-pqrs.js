let listRequest=0;
// ============================================================
// LISTA-PQRS.JS - Listado con filtros y paginación server-side
// ============================================================

let currentPage = 1;
let totalRecords = 0;
let viendoEliminados = false;
let currentDb = null;
let filtros = {
  search: '',
  estado: '',
  area: '',
  tipo: '',
  prioridad: '',
  desde: '',
  hasta: '',
  tag: ''
};

document.addEventListener('DOMContentLoaded', () => {
  withReader(async (db) => {
    currentDb = db;

    // Verificar parámetro de eliminación
    const params = new URLSearchParams(window.location.search);
    if (params.get('eliminado') === '1') {
      viendoEliminados = true;
      Utils.showToast('PQRS archivado.');
      const btn = document.getElementById('btnVerEliminados');
      if (btn) {
        btn.innerHTML = '<i class="bi bi-list-check"></i> Ver Activos';
        btn.className = 'btn btn-warning btn-sm';
      }
      const titulo = document.querySelector('.page-title');
      if (titulo) titulo.textContent = 'PQRS archivados';
      history.replaceState(null, '', 'lista-pqrs.html');
    }

    await cargarPagina(db, 1);
    bindFilters();
    bindExport();
    bindVerEliminados();
  });
});

function bindVerEliminados() {
  const btn = document.getElementById('btnVerEliminados');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    viendoEliminados = !viendoEliminados;
    btn.innerHTML = viendoEliminados
      ? '<i class="bi bi-list-check"></i> Ver Activos'
      : '<i class="bi bi-trash"></i> Ver archivados';
    btn.className = viendoEliminados ? 'btn btn-warning btn-sm' : 'btn btn-outline btn-sm';

    const titulo = document.querySelector('.page-title');
    if (titulo) {
      titulo.textContent = viendoEliminados ? 'PQRS archivados' : 'Todos los PQRS';
    }

    await cargarPagina(currentDb, 1);
  });
}

async function cargarPagina(db, page = 1) {
  const request = ++listRequest;
  document.getElementById('tbodyLista').innerHTML='<tr><td colspan="10" role="status">Cargando solicitudes…</td></tr>';
  const offset = (page - 1) * CONFIG.ITEMS_POR_PAGINA;

  // Construir query base
  let query = db.from('pqrs')
    .select('id, numero_caso, nombre_cliente, cedula, tipo_solicitud, area_responsable, prioridad, estado, motivo, fecha_registro, tags, eliminado, eliminado_en, eliminado_por', { count: 'exact' })
    .order('fecha_registro', { ascending: document.getElementById('filtroOrden')?.value === 'asc' }).order('id')
    .range(offset, offset + CONFIG.ITEMS_POR_PAGINA - 1);

  query = Data.filters(query, filtros, viendoEliminados);
  const { data, count, error } = await query;

  if (request !== listRequest) return;
  if (error) {
    console.warn('Error cargando PQRS:', error.code || 'connection');
    Utils.showToast('Error al cargar datos', 'error');
    document.getElementById('tbodyLista').innerHTML='<tr><td colspan="10" role="alert">No se pudieron cargar los casos. Vuelve a aplicar los filtros.</td></tr>';
    document.getElementById('pagination').replaceChildren();
    return;
  }

  totalRecords = count || 0;
  currentPage = page;

  const countLabel = document.getElementById('countLabel');
  if (countLabel) {
    countLabel.textContent = `Mostrando ${totalRecords} registro${totalRecords !== 1 ? 's' : ''}`;
  }

  renderTabla(data || []);
  renderPaginacion(totalRecords, page);
}

function bindFilters() {
  const btnFiltrar = document.getElementById('btnFiltrar');
  const btnLimpiar = document.getElementById('btnLimpiar');
  const filtroSearch = document.getElementById('filtroSearch');

  document.getElementById('filtroOrden')?.addEventListener('change',aplicarFiltros);
  btnFiltrar?.addEventListener('click', aplicarFiltros);
  btnLimpiar?.addEventListener('click', limpiarFiltros);

  if (filtroSearch) {
    filtroSearch.addEventListener('input', () => {
      clearTimeout(window._searchTimer);
      window._searchTimer = setTimeout(aplicarFiltros, 300);
    });
  }
}

async function aplicarFiltros() {
  filtros.search = (document.getElementById('filtroSearch')?.value || '').toLowerCase().trim();
  filtros.estado = document.getElementById('filtroEstado')?.value || '';
  filtros.area = document.getElementById('filtroArea')?.value || '';
  filtros.tipo = document.getElementById('filtroTipo')?.value || '';
  filtros.prioridad = document.getElementById('filtroPrioridad')?.value || '';
  filtros.desde = document.getElementById('filtroDesde')?.value || '';
  filtros.hasta = document.getElementById('filtroHasta')?.value || '';
  filtros.tag = document.getElementById('filtroTag')?.value.trim() || '';
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) { Utils.showToast('La fecha inicial debe ser anterior a la final.','warning'); return; }

  await cargarPagina(currentDb, 1);
}

async function limpiarFiltros() {
  ['filtroSearch', 'filtroEstado', 'filtroArea', 'filtroTipo', 'filtroPrioridad', 'filtroDesde', 'filtroHasta', 'filtroTag'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  filtros = { search: '', estado: '', area: '', tipo: '', prioridad: '', desde: '', hasta: '', tag: '' };
  await cargarPagina(currentDb, 1);
}

function renderTabla(data) {
  const tbody = document.getElementById('tbodyLista');
  if (!tbody) return;

  if (data.length === 0) {
    const msg = viendoEliminados
      ? 'La papelera está vacía. ¡No hay PQRS eliminados!'
      : 'No se encontraron PQRS con estos filtros. Prueba ajustando la búsqueda.';
    tbody.innerHTML = `<tr><td colspan="10">
      <div class="empty-mascot">
        <img src="img/mascota-pepo.png?v=15" alt="Mascota Pepo's Cake" />
        <span class="empty-title">Nada por aquí</span>
        <p>${msg}</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(row => {
    const sla = viendoEliminados ? null : Utils.calcularEstadoSLA(row);
    const slaBadge = viendoEliminados
      ? `<small style="color:var(--color-text-muted)">${row.eliminado_en ? Utils.formatFechaCorta(row.eliminado_en) : '—'}</small>`
      : Utils.renderSlaBadge(row);
    const tagsBadges = (row.tags || []).map(t => `<span class="tag-badge">${Utils.escapeHtml(t)}</span>`).join('');

    const accion = !tieneRol('admin')
      ? `<a href="detalle-pqrs.html?id=${row.id}" class="btn btn-outline btn-sm">Ver</a>`
      : viendoEliminados
      ? `<button class="btn btn-outline btn-sm" data-restore="${row.id}" title="Restaurar"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>`
      : `<div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
          <a href="detalle-pqrs.html?id=${row.id}" class="btn btn-outline btn-sm" title="Ver detalles"><i class="bi bi-eye"></i> Ver</a>
          <button class="btn btn-outline btn-sm" style="color:#D64045" title="Archivar" data-archive="${row.id}" data-case="${Utils.escapeHtml(row.numero_caso)}"><i class="bi bi-trash"></i></button>
        </div>`;

    // Clase de fila por estado (tinte + borde izquierdo); rojo si SLA vencido
    const slaVencido = sla && sla.nivel === 'vencido';
    const rowClass = viendoEliminados
      ? 'row-estado'
      : `row-estado row-${row.estado}${slaVencido ? ' row-sla-vencido' : ''}`;

    return `<tr class="${rowClass}" ${viendoEliminados ? 'style="opacity:0.6"' : ''}>
      <td data-label="Nº Caso"><strong style="color:var(--color-primary)">${Utils.escapeHtml(row.numero_caso)}</strong>${tagsBadges ? '<br><small>' + tagsBadges + '</small>' : ''}</td>
      <td data-label="Fecha" style="white-space:nowrap; font-size:0.9rem">${Utils.formatFecha(row.fecha_registro)}</td>
      <td data-label="Cliente">${Utils.escapeHtml(row.nombre_cliente)}</td>
      <td data-label="Tipo">${Utils.badgeTipo(row.tipo_solicitud)}</td>
      <td data-label="Prioridad">${Utils.badgePrioridad(row.prioridad)}</td>
      <td data-label="Área">${Utils.labelArea(row.area_responsable)}</td>
      <td data-label="Motivo" style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${Utils.escapeHtml(row.motivo)}">${Utils.escapeHtml(Utils.truncate(row.motivo, 30))}</td>
      <td data-label="SLA" style="text-align:center">${slaBadge}</td>
      <td data-label="Estado">${Utils.badgeEstado(row.estado)}</td>
      <td data-label="Acciones">${accion}</td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-archive]').forEach(btn=>btn.addEventListener('click',()=>eliminarDesdeLista(btn.dataset.archive,btn.dataset.case)));
  tbody.querySelectorAll('[data-restore]').forEach(btn=>btn.addEventListener('click',()=>restaurarPQRS(btn.dataset.restore)));
}

function renderPaginacion(total, page) {
  const container = document.getElementById('pagination');
  if (!container) return;

  const totalPages = Math.ceil(total / CONFIG.ITEMS_POR_PAGINA);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '<div style="display:flex; gap:0.35rem; justify-content:center; flex-wrap:wrap; align-items:center;">';
  html += `<button class="page-btn" onclick="cargarPaginaUI(${page - 1})" ${page === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="cargarPaginaUI(${i})">${i}</button>`;
    } else if (Math.abs(i - page) === 2) {
      html += '<span class="page-btn" style="cursor:default;padding:0">…</span>';
    }
  }

  html += `<button class="page-btn" onclick="cargarPaginaUI(${page + 1})" ${page === totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>`;
  html += '<small style="color:var(--color-text-muted); margin-left:1rem">Página ' + page + ' de ' + totalPages + '</small>';
  html += '</div>';
  container.innerHTML = html;
}

async function cargarPaginaUI(page) {
  await cargarPagina(currentDb, page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindExport() {
  const btn = document.getElementById('btnExportExcel');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (typeof exportToExcel !== 'function') return;

      if(btn.disabled)return;btn.disabled=true;
      try { const data=await Data.all(currentDb,'*',filtros,viendoEliminados);exportToExcel(data,'PQRS_Pepos_Cake'); }
      catch { Utils.showToast('No se pudo exportar. Reduce el rango o revisa la conexión.','error'); }
      finally { btn.disabled=false; }
    });
  }
}

async function eliminarDesdeLista(id, numeroCaso) {
  const confirmar = await Utils.confirmModal({title:'Archivar solicitud',message:`¿Archivar ${numeroCaso}? Puedes restaurarlo desde el listado.`,confirmText:'Archivar',variant:'danger'});
  if (!confirmar) return;
  withAdmin(async (db) => {
    const { data: { user } } = await db.auth.getUser();
    const eliminadoPor = user?.email || user?.id || 'Desconocido';
    const { error } = await db
      .from('pqrs')
      .update({ eliminado: true, eliminado_en: new Date().toISOString(), eliminado_por: eliminadoPor })
      .eq('id', id).select('id').single();
    if (error) { alert('Error al eliminar: ' + error.message); return; }
    Utils.showToast(`✅ ${numeroCaso} archivado.`);
    await cargarPagina(db, 1);
  });
}

async function restaurarPQRS(id) {
  const confirmar = await Utils.confirmModal({title:'Restaurar solicitud',message:'El caso volverá a aparecer en la lista activa.',confirmText:'Restaurar'});
  if (!confirmar) return;
  withAdmin(async (db) => {
    const { error } = await db
      .from('pqrs')
      .update({ eliminado: false, eliminado_en: null, eliminado_por: null })
      .eq('id', id).select('id').single();
    if (error) { alert('Error al restaurar: ' + error.message); return; }
    await cargarPagina(db, 1);
  });
}
