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
  withSupabase(async (db) => {
    currentDb = db;

    // Verificar parámetro de eliminación
    const params = new URLSearchParams(window.location.search);
    if (params.get('eliminado') === '1') {
      viendoEliminados = true;
      Utils.showToast('PQRS eliminado y movido a la papelera.');
      const btn = document.getElementById('btnVerEliminados');
      if (btn) {
        btn.innerHTML = '<i class="bi bi-list-check"></i> Ver Activos';
        btn.className = 'btn btn-warning btn-sm';
      }
      const titulo = document.querySelector('.page-title');
      if (titulo) titulo.textContent = 'PQRS Eliminados';
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
      : '<i class="bi bi-trash"></i> Ver Eliminados';
    btn.className = viendoEliminados ? 'btn btn-warning btn-sm' : 'btn btn-outline btn-sm';

    const titulo = document.querySelector('.page-title');
    if (titulo) {
      titulo.textContent = viendoEliminados ? 'PQRS Eliminados' : 'Todos los PQRS';
    }

    await cargarPagina(currentDb, 1);
  });
}

function calcularSLA(row) {
  if (row.estado === 'Resuelto') {
    return { clase: 'sla-ok', texto: '<i class="bi bi-check-circle"></i> Resuelto', horas: 0 };
  }

  const horas = CONFIG.SLA_HORAS[row.tipo_solicitud];
  if (!horas) return { clase: 'sla-info', texto: 'N/A', horas: 0 };

  const registro = new Date(row.fecha_registro);
  const ahora = new Date();
  const msTranscurridos = ahora - registro;
  const horasTranscurridas = msTranscurridos / 3600000;
  const horasRestantes = horas - horasTranscurridas;

  if (horasRestantes < 0) {
    return { clase: 'sla-vencido', texto: '<i class="bi bi-exclamation-circle"></i> Vencido', horas: 0 };
  }

  if (horasRestantes < 24) {
    const color = horasRestantes < 12 ? 'sla-critico' : 'sla-warning';
    return { clase: color, texto: `<i class="bi bi-clock"></i> ${Math.ceil(horasRestantes)}h`, horas: horasRestantes };
  }

  const diasRestantes = Math.ceil(horasRestantes / 24);
  return { clase: 'sla-ok', texto: `<i class="bi bi-check"></i> ${diasRestantes}d`, horas: horasRestantes };
}

async function cargarPagina(db, page = 1) {
  const offset = (page - 1) * CONFIG.ITEMS_POR_PAGINA;

  // Construir query base
  let query = db.from('pqrs')
    .select('id, numero_caso, nombre_cliente, tipo_solicitud, area_responsable, prioridad, estado, motivo, fecha_registro, tags, eliminado, eliminado_en, eliminado_por', { count: 'exact' })
    .order('fecha_registro', { ascending: false })
    .range(offset, offset + CONFIG.ITEMS_POR_PAGINA - 1);

  // Filtro de eliminados
  if (viendoEliminados) {
    query = query.eq('eliminado', true);
  } else {
    query = query.or('eliminado.is.null,eliminado.eq.false');
  }

  // Aplicar filtros
  if (filtros.search) {
    query = query.or(`numero_caso.ilike.%${filtros.search}%,nombre_cliente.ilike.%${filtros.search}%`);
  }
  if (filtros.estado) query = query.eq('estado', filtros.estado);
  if (filtros.area) query = query.eq('area_responsable', filtros.area);
  if (filtros.tipo) query = query.eq('tipo_solicitud', filtros.tipo);
  if (filtros.prioridad) query = query.eq('prioridad', filtros.prioridad);
  if (filtros.desde) query = query.gte('fecha_registro', filtros.desde + 'T00:00:00');
  if (filtros.hasta) query = query.lte('fecha_registro', filtros.hasta + 'T23:59:59');

  const { data, count, error } = await query;

  if (error) {
    console.error('Error cargando PQRS:', error);
    Utils.showToast('Error al cargar datos', 'error');
    renderTabla([]);
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

  await cargarPagina(currentDb, 1);
}

async function limpiarFiltros() {
  ['filtroSearch', 'filtroEstado', 'filtroArea', 'filtroTipo', 'filtroPrioridad', 'filtroDesde', 'filtroHasta'].forEach(id => {
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
        <img src="img/mascota-pepo.png?v=8" alt="Mascota Pepo's Cake" />
        <span class="empty-title">Nada por aquí</span>
        <p>${msg}</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(row => {
    const sla = viendoEliminados ? null : calcularSLA(row);
    const slaBadge = sla
      ? `<span class="sla-badge ${sla.clase}" title="SLA: ${Math.round(sla.horas)}h">${sla.texto}</span>`
      : (viendoEliminados ? `<small style="color:var(--color-text-muted)">${row.eliminado_en ? Utils.formatFechaCorta(row.eliminado_en) : '—'}</small>` : '—');
    const tagsBadges = (row.tags || []).map(t => `<span class="tag-badge">${Utils.escapeHtml(t)}</span>`).join('');

    const accion = viendoEliminados
      ? `<button class="btn btn-outline btn-sm" onclick="restaurarPQRS('${row.id}')" title="Restaurar"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>`
      : `<div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
          <a href="detalle-pqrs.html?id=${row.id}" class="btn btn-outline btn-sm" title="Ver detalles"><i class="bi bi-eye"></i> Ver</a>
          <button class="btn btn-outline btn-sm" style="color:#D64045" title="Eliminar" onclick="eliminarDesdeLista('${row.id}', '${Utils.escapeHtml(row.numero_caso)}')"><i class="bi bi-trash"></i></button>
        </div>`;

    return `<tr ${viendoEliminados ? 'style="opacity:0.6"' : ''}>
      <td><strong style="color:var(--color-primary)">${Utils.escapeHtml(row.numero_caso)}</strong>${tagsBadges ? '<br><small>' + tagsBadges + '</small>' : ''}</td>
      <td style="white-space:nowrap; font-size:0.9rem">${Utils.formatFecha(row.fecha_registro)}</td>
      <td>${Utils.escapeHtml(row.nombre_cliente)}</td>
      <td>${Utils.badgeTipo(row.tipo_solicitud)}</td>
      <td>${Utils.badgePrioridad(row.prioridad)}</td>
      <td>${Utils.labelArea(row.area_responsable)}</td>
      <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${Utils.escapeHtml(row.motivo)}">${Utils.truncate(row.motivo, 30)}</td>
      <td style="text-align:center">${slaBadge}</td>
      <td>${Utils.badgeEstado(row.estado)}</td>
      <td>${accion}</td>
    </tr>`;
  }).join('');
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
      let query = currentDb.from('pqrs')
        .select('*');

      if (viendoEliminados) {
        query = query.eq('eliminado', true);
      } else {
        query = query.or('eliminado.is.null,eliminado.eq.false');
      }

      if (filtros.search) query = query.or(`numero_caso.ilike.%${filtros.search}%,nombre_cliente.ilike.%${filtros.search}%`);
      if (filtros.estado) query = query.eq('estado', filtros.estado);
      if (filtros.area) query = query.eq('area_responsable', filtros.area);
      if (filtros.tipo) query = query.eq('tipo_solicitud', filtros.tipo);
      if (filtros.desde) query = query.gte('fecha_registro', filtros.desde + 'T00:00:00');
      if (filtros.hasta) query = query.lte('fecha_registro', filtros.hasta + 'T23:59:59');

      const { data } = await query;
      if (data) exportToExcel(data, 'PQRS_Pepos_Cake');
    });
  }
}

function eliminarDesdeLista(id, numeroCaso) {
  const confirmar = confirm(`¿Eliminar ${numeroCaso}?\n\nEl caso se moverá a la papelera. Podrás restaurarlo desde "Ver Eliminados".`);
  if (!confirmar) return;
  withSupabase(async (db) => {
    const { data: { user } } = await db.auth.getUser();
    const eliminadoPor = user?.email || user?.id || 'Desconocido';
    const { error } = await db
      .from('pqrs')
      .update({ eliminado: true, eliminado_en: new Date().toISOString(), eliminado_por: eliminadoPor })
      .eq('id', id);
    if (error) { alert('Error al eliminar: ' + error.message); return; }
    mostrarBannerExito(`✅ ${numeroCaso} eliminado y movido a la papelera.`);
    await cargarPagina(db, 1);
  });
}

function restaurarPQRS(id) {
  const confirmar = confirm('¿Restaurar este PQRS? Volverá a aparecer en la lista activa.');
  if (!confirmar) return;
  withSupabase(async (db) => {
    const { error } = await db
      .from('pqrs')
      .update({ eliminado: false, eliminado_en: null })
      .eq('id', id);
    if (error) { alert('Error al restaurar: ' + error.message); return; }
    await cargarPagina(db, 1);
  });
}
