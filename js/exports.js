// ============================================================
// EXPORTS.JS - Exportar a Excel (XLSX) y PDF
// Depende de SheetJS (xlsx) cargado desde CDN en las páginas
// ============================================================

// Carga SheetJS dinámicamente si no está presente
(function loadXLSX() {
  if (window.XLSX) return;
  const script = document.createElement('script');
  script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
  document.head.appendChild(script);
})();

/**
 * Exporta un array de objetos PQRS a un archivo .xlsx
 * @param {Array} data - Filas de datos
 * @param {string} filename - Nombre del archivo (sin extensión)
 */
function exportToExcel(data, filename = 'PQRS_Export') {
  if (!data || data.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  function waitXLSX(cb) {
    if (window.XLSX) { cb(); return; }
    const t = setInterval(() => { if (window.XLSX) { clearInterval(t); cb(); } }, 50);
  }

  waitXLSX(() => {
    // Mapear campos a encabezados legibles
    const rows = data.map(row => ({
      'Nº Caso':               row.numero_caso || '',
      'Fecha Registro':        row.fecha_registro ? formatFechaExcel(row.fecha_registro) : '',
      'Nombre Cliente':        row.nombre_cliente || '',
      'Teléfono':              row.telefono_cliente || '',
      'Correo':                row.correo_cliente || '',
      'Tipo de Solicitud':     labelTipo(row.tipo_solicitud),
      'Área Responsable':      labelArea(row.area_responsable),
      'Prioridad':             labelPrioridad(row.prioridad),
      'Motivo':                row.motivo || '',
      'Descripción':           row.descripcion || '',
      'Comentarios Adicionales': row.comentarios_adicionales || '',
      'Estado':                labelEstado(row.estado),
      'Solución':              row.solucion || '',
      'Fecha Resolución':      row.fecha_resolucion ? formatFechaExcel(row.fecha_resolucion) : '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Ancho de columnas
    ws['!cols'] = [
      { wch: 20 }, // Nº Caso
      { wch: 20 }, // Fecha
      { wch: 30 }, // Nombre
      { wch: 18 }, // Teléfono
      { wch: 28 }, // Correo
      { wch: 18 }, // Tipo
      { wch: 22 }, // Área
      { wch: 12 }, // Prioridad
      { wch: 35 }, // Motivo
      { wch: 55 }, // Descripción
      { wch: 40 }, // Comentarios
      { wch: 14 }, // Estado
      { wch: 55 }, // Solución
      { wch: 20 }, // Fecha Resolución
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'PQRS');

    // Hoja de resumen
    const resumen = generarResumenExcel(data);
    const wsResumen = XLSX.utils.json_to_sheet(resumen);
    wsResumen['!cols'] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${filename}_${fecha}.xlsx`);
  });
}

function generarResumenExcel(data) {
  const total = data.length;
  const porEstado = {};
  const porArea = {};
  const porTipo = {};

  data.forEach(row => {
    porEstado[row.estado] = (porEstado[row.estado] || 0) + 1;
    porArea[row.area_responsable] = (porArea[row.area_responsable] || 0) + 1;
    porTipo[row.tipo_solicitud] = (porTipo[row.tipo_solicitud] || 0) + 1;
  });

  const rows = [
    { 'Categoría': '=== RESUMEN GENERAL ===', 'Cantidad': '' },
    { 'Categoría': 'Total PQRS', 'Cantidad': total },
    { 'Categoría': '', 'Cantidad': '' },
    { 'Categoría': '=== POR ESTADO ===', 'Cantidad': '' },
    ...Object.entries(porEstado).map(([k, v]) => ({ 'Categoría': labelEstado(k), 'Cantidad': v })),
    { 'Categoría': '', 'Cantidad': '' },
    { 'Categoría': '=== POR ÁREA ===', 'Cantidad': '' },
    ...Object.entries(porArea).map(([k, v]) => ({ 'Categoría': labelArea(k), 'Cantidad': v })),
    { 'Categoría': '', 'Cantidad': '' },
    { 'Categoría': '=== POR TIPO ===', 'Cantidad': '' },
    ...Object.entries(porTipo).map(([k, v]) => ({ 'Categoría': labelTipo(k), 'Cantidad': v })),
  ];

  return rows;
}

function formatFechaExcel(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
