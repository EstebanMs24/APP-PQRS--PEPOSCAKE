// ============================================================
// LISTA-PQRS.JS - Listado con filtros y paginación
// ============================================================

const SLA_DIAS = { Reclamo: 3, Queja: 5, Peticion: 7, Sugerencia: 10 };

function calcularSLA(row) {
  if (row.estado === 'Resuelto') return { clase: 'sla-resuelto', texto: '✅ Resuelto' };
  const dias = SLA_DIAS[row.tipo_solicitud];
  if (!dias) return null;
  const fechaRegistro = new Date(row.fecha_registro);
  const fechaLimite = new Date(fechaRegistro.getTime() + dias * 86400000);
  const ahora = new Date();
  const diffMs = fechaLimite - ahora;
  const diffHoras = diffMs / 3600000;
  if (diffMs < 0) return { clase: 'sla-vencido', texto: `🔴 Venció` };
  if (diffHoras < 24) return { clase: 'sla-warning', texto: `🟡 <24h` };
  const diasRestantes = Math.ceil(diffMs / 86400000);
  return { clase: 'sla-ok', texto: `🟢 ${diasRestantes}d` };
}

const PAGE_SIZE = 15;
let currentPage = 1;
let allData = [];
let filteredData = [];

document.addEventListener('DOMContentLoaded', () => {
  withSupabase(async (db) => {
    await cargarTodos(db);
    bindFilters();
    bindExport();
  });
});

async function cargarTodos(db) {
  const { data, error } = await db
    .from('pqrs')
    .select('id, numero_caso, nombre_cliente, tipo_solicitud, area_responsable, estado, motivo, fecha_registro, tags')
    .order('fecha_registro', { ascending: false });

  if (error) {
    renderTabla([]);
    return;
  }
  allData = data || [];
  filteredData = allData.slice();
  renderPagina(1);
}

function bindFilters() {
  document.getElementById('btnFiltrar').addEventListener('click', aplicarFiltros);
  document.getElementById('btnLimpiar').addEventListener('click', limpiarFiltros);

  // Filtrar en tiempo real para búsqueda de texto
  document.getElementById('filtroSearch').addEventListener('input', () => {
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(aplicarFiltros, 300);
  });
}

function aplicarFiltros() {
  const search  = document.getElementById('filtroSearch').value.toLowerCase().trim();
  const estado  = document.getElementById('filtroEstado').value;
  const area    = document.getElementById('filtroArea').value;
  const tipo    = document.getElementById('filtroTipo').value;
  const desde   = document.getElementById('filtroDesde').value;
  const hasta   = document.getElementById('filtroHasta').value;
  const tag     = (document.getElementById('filtroTag')?.value || '').toLowerCase().trim();

  filteredData = allData.filter(row => {
    if (search && !row.numero_caso.toLowerCase().includes(search) &&
        !row.nombre_cliente.toLowerCase().includes(search)) return false;
    if (estado && row.estado !== estado) return false;
    if (area  && row.area_responsable !== area) return false;
    if (tipo  && row.tipo_solicitud !== tipo) return false;
    if (desde) {
      const fechaRow = new Date(row.fecha_registro).toISOString().split('T')[0];
      if (fechaRow < desde) return false;
    }
    if (hasta) {
      const fechaRow = new Date(row.fecha_registro).toISOString().split('T')[0];
      if (fechaRow > hasta) return false;
    }
    if (tag) {
      const rowTags = (row.tags || []).map(t => t.toLowerCase());
      if (!rowTags.some(t => t.includes(tag))) return false;
    }
    return true;
  });

  renderPagina(1);
}

function limpiarFiltros() {
  ['filtroSearch','filtroEstado','filtroArea','filtroTipo','filtroDesde','filtroHasta','filtroTag']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  filteredData = allData.slice();
  renderPagina(1);
}

function renderPagina(page) {
  currentPage = page;
  const start = (page - 1) * PAGE_SIZE;
  const slice = filteredData.slice(start, start + PAGE_SIZE);

  const countLabel = document.getElementById('countLabel');
  if (countLabel) {
    countLabel.textContent = `Mostrando ${filteredData.length} caso${filteredData.length !== 1 ? 's' : ''}`;
  }

  renderTabla(slice);
  renderPaginacion(filteredData.length, page);
}

function renderTabla(data) {
  const tbody = document.getElementById('tbodyLista');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding:2rem; color:var(--color-text-muted);">No se encontraron resultados.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => {
    const sla = calcularSLA(row);
    const slaBadge = sla ? `<span class="sla-badge ${sla.clase}">${sla.texto}</span>` : '—';
    const tagsBadges = (row.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('');
    return `
    <tr>
      <td><strong style="color:var(--color-primary-dark)">${escapeHtml(row.numero_caso)}</strong>${tagsBadges ? '<br>' + tagsBadges : ''}</td>
      <td style="white-space:nowrap">${formatFecha(row.fecha_registro)}</td>
      <td>${escapeHtml(row.nombre_cliente)}</td>
      <td>${badgeTipo(row.tipo_solicitud)}</td>
      <td>${escapeHtml(labelArea(row.area_responsable))}</td>
      <td style="max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(row.motivo)}">${escapeHtml(row.motivo)}</td>
      <td>${slaBadge}</td>
      <td>${badgeEstado(row.estado)}</td>
      <td>
        <a href="detalle-pqrs.html?id=${row.id}" class="btn btn-outline btn-sm">👁️ Ver</a>
      </td>
    </tr>
  `;
  }).join('');
}

function renderPaginacion(total, currentPage) {
  const container = document.getElementById('pagination');
  if (!container) return;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button class="page-btn" onclick="renderPagina(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="renderPagina(${i})">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 3) {
      html += `<span class="page-btn" style="cursor:default">…</span>`;
    }
  }

  html += `<button class="page-btn" onclick="renderPagina(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;
  container.innerHTML = html;
}

function bindExport() {
  const btn = document.getElementById('btnExportExcel');
  if (btn) {
    btn.addEventListener('click', () => {
      if (typeof exportToExcel === 'function') {
        exportToExcel(filteredData, 'PQRS_Pepos_Cake');
      }
    });
  }
}

function escapeHtml(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
