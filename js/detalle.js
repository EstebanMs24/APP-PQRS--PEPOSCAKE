// ============================================================
// DETALLE.JS - Ver, actualizar estado y seguimiento de un PQRS
// ============================================================

let casoActual = null;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = 'lista-pqrs.html';
    return;
  }

  withSupabase(async (db) => {
    await cargarDetalle(db, id);

    // Botón volver
    const btnVolver = document.getElementById('btnVolver');
    if (btnVolver) btnVolver.addEventListener('click', () => history.back());

    // Botón PDF
    const btnPDF = document.getElementById('btnPDF');
    if (btnPDF) btnPDF.addEventListener('click', () => generarPDF(casoActual));

    // Botón Eliminar
    const btnEliminar = document.getElementById('btnEliminar');
    if (btnEliminar) btnEliminar.addEventListener('click', () => eliminarPQRS(db, id));
  });
});

async function cargarDetalle(db, id) {
  const mainEl = document.getElementById('detalleContenido');

  const { data, error } = await db
    .from('pqrs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    mainEl.innerHTML = `<div class="alert alert-error">No se encontró el caso solicitado.</div>`;
    return;
  }

  casoActual = data;

  // Clonar template
  const template = document.getElementById('templateDetalle');
  const clone = template.content.cloneNode(true);
  mainEl.innerHTML = '';
  mainEl.appendChild(clone);

  // Poblar datos
  setDetalle('d-numero_caso', data.numero_caso);
  setDetalle('d-fecha_registro', formatFecha(data.fecha_registro));
  setDetalle('d-nombre_cliente', data.nombre_cliente);
  setDetalle('d-cedula', data.cedula || '—');
  setDetalle('d-telefono_cliente', data.telefono_cliente || '—');
  setDetalle('d-correo_cliente', data.correo_cliente || '—');
  setDetalle('d-tipo_solicitud', labelTipo(data.tipo_solicitud));
  setDetalle('d-area_responsable', labelArea(data.area_responsable));
  const prioridadEl = document.getElementById('d-prioridad');
  if (prioridadEl) prioridadEl.innerHTML = Utils.badgePrioridad(data.prioridad);
  setDetalle('d-motivo', data.motivo);
  setDetalle('d-descripcion', data.descripcion);

  // Comentarios adicionales
  if (data.comentarios_adicionales) {
    setDetalle('d-comentarios_adicionales', data.comentarios_adicionales);
  } else {
    const sec = document.getElementById('secComentariosAdicionales');
    if (sec) sec.style.display = 'none';
  }

  // Badge de estado
  const badgeEl = document.getElementById('d-badge-estado');
  if (badgeEl) {
    badgeEl.className = `badge-estado badge-${data.estado}`;
    badgeEl.textContent = labelEstado(data.estado);
  }

  // Hero: cliente, meta y chips
  setDetalle('d-hero-cliente', data.nombre_cliente);
  const metaEl = document.getElementById('d-hero-meta');
  if (metaEl) {
    const partes = [`<span><i class="bi bi-calendar3"></i> ${formatFecha(data.fecha_registro)}</span>`];
    if (data.correo_cliente) partes.push(`<span><i class="bi bi-envelope"></i> ${escapeHtml(data.correo_cliente)}</span>`);
    if (data.telefono_cliente) partes.push(`<span><i class="bi bi-telephone"></i> ${escapeHtml(data.telefono_cliente)}</span>`);
    metaEl.innerHTML = partes.join('');
  }
  const chipsEl = document.getElementById('d-hero-chips');
  if (chipsEl) {
    let chips = `<span class="chip"><i class="bi bi-tag-fill"></i> ${labelTipo(data.tipo_solicitud)}</span>`;
    chips += `<span class="chip"><i class="bi bi-building"></i> ${labelArea(data.area_responsable)}</span>`;
    chips += `<span class="chip"><i class="bi bi-flag-fill"></i> ${labelPrioridad(data.prioridad)}</span>`;
    (data.tags || []).forEach(t => { chips += `<span class="chip"><i class="bi bi-hash"></i> ${escapeHtml(t)}</span>`; });
    chipsEl.innerHTML = chips;
  }
  renderSlaRing(data);

  // Título de página
  const titulo = document.getElementById('paginaTitulo');
  if (titulo) titulo.textContent = `Caso ${data.numero_caso}`;

  // Solución
  if (data.estado === 'Resuelto' && data.solucion) {
    const cardSol = document.getElementById('cardSolucion');
    if (cardSol) cardSol.style.display = '';
    setDetalle('d-solucion', data.solucion);
    if (data.fecha_resolucion) {
      setDetalle('d-fecha_resolucion', 'Resuelto el ' + formatFecha(data.fecha_resolucion));
    }
  }

  // Evidencias fotográficas
  if (data.imagenes && Array.isArray(data.imagenes) && data.imagenes.length > 0) {
    const cardEv = document.getElementById('cardEvidencias');
    const gridEv = document.getElementById('d-evidencias');
    if (cardEv && gridEv) {
      cardEv.style.display = '';
      gridEv.innerHTML = data.imagenes.map(url => `
        <a href="${url}" target="_blank" rel="noopener noreferrer">
          <img src="${url}" alt="Evidencia fotográfica" class="evidencia-img" />
        </a>
      `).join('');
    }
  }

  // Establecer estado actual en el select
  const selectEstado = document.getElementById('nuevoEstado');
  if (selectEstado) selectEstado.value = data.estado;

  // Mostrar/ocultar campo solución si estado = Resuelto
  if (selectEstado) {
    selectEstado.addEventListener('change', () => {
      const grupoSolucion = document.getElementById('grupoSolucion');
      if (grupoSolucion) {
        grupoSolucion.style.display = selectEstado.value === 'Resuelto' ? '' : 'none';
      }
    });
    // Ejecutar una vez
    const grupoSolucion = document.getElementById('grupoSolucion');
    if (grupoSolucion) {
      grupoSolucion.style.display = data.estado === 'Resuelto' ? '' : 'none';
    }
  }

  // Bind formulario de actualización
  const formEstado = document.getElementById('formActualizarEstado');
  if (formEstado) {
    formEstado.addEventListener('submit', (e) => actualizarEstado(e, db, id));
  }

  // Cargar historial
  await cargarHistorial(db, id);
}

async function actualizarEstado(e, db, id) {
  e.preventDefault();
  const btn = document.getElementById('btnActualizar');
  const alertEl = document.getElementById('alertEstado');

  const nuevoEstado = document.getElementById('nuevoEstado').value;
  const comentario = document.getElementById('textoComentario').value.trim();
  const solucion = document.getElementById('textoSolucion')
    ? document.getElementById('textoSolucion').value.trim()
    : '';

  if (!comentario) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'El comentario de seguimiento es obligatorio.';
    alertEl.style.display = 'block';
    return;
  }

  if (nuevoEstado === 'Resuelto' && !solucion) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Debes ingresar la descripción de la solución.';
    alertEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Guardando...';
  alertEl.style.display = 'none';

  const user = await getCurrentUser();

  // Actualizar el PQRS
  const updatePayload = { estado: nuevoEstado };
  if (nuevoEstado === 'Resuelto') {
    updatePayload.solucion = solucion;
    updatePayload.fecha_resolucion = new Date().toISOString();
  }

  const { error: errUpdate } = await db
    .from('pqrs')
    .update(updatePayload)
    .eq('id', id);

  if (errUpdate) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Error al actualizar: ' + errUpdate.message;
    alertEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '💾 Actualizar Estado';
    return;
  }

  // Insertar seguimiento
  const nombreUsuario = document.getElementById('userName')?.textContent || 'Agente';
  await db.from('seguimiento_pqrs').insert({
    pqrs_id: id,
    comentario: comentario,
    estado_nuevo: nuevoEstado,
    creado_por: user ? user.id : null,
    nombre_usuario: nombreUsuario
  });

  alertEl.className = 'alert alert-success';
  alertEl.textContent = '✅ Estado actualizado correctamente.';
  alertEl.style.display = 'block';

  // Recargar página para ver cambios
  setTimeout(() => window.location.reload(), 1200);
}

async function cargarHistorial(db, id) {
  const timeline = document.getElementById('timeline');
  if (!timeline) return;

  const { data, error } = await db
    .from('seguimiento_pqrs')
    .select('*')
    .eq('pqrs_id', id)
    .order('creado_en', { ascending: false });

  if (error || !data || data.length === 0) {
    timeline.innerHTML = '<div class="text-muted p-3 text-center">Sin comentarios de seguimiento aún.</div>';
    return;
  }

  timeline.innerHTML = data.map(item => `
    <div class="timeline-item">
      <div class="timeline-header">
        <span class="timeline-user">👤 ${escapeHtml(item.nombre_usuario || 'Sistema')}</span>
        ${item.estado_nuevo ? `<span class="badge badge-${item.estado_nuevo}">${labelEstado(item.estado_nuevo)}</span>` : ''}
        <span class="timeline-date">${formatFecha(item.creado_en)}</span>
      </div>
      <p class="timeline-text">${escapeHtml(item.comentario)}</p>
    </div>
  `).join('');
}

// ============================================================
// GENERAR PDF CON jsPDF
// ============================================================
function generarPDF(caso) {
  if (!caso) return;
  if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
    alert('La librería de PDF no está disponible. Verifica tu conexión a internet.');
    return;
  }

  const { jsPDF } = window.jspdf || window;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const margen = 18;
  const ancho = 210 - margen * 2;
  let y = margen;

  // ---- ENCABEZADO ----
  doc.setFillColor(78, 205, 196);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text("PEPO'S CAKE - Repostería", margen, 13);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestión PQRS', margen, 21);
  doc.setFontSize(10);
  doc.text(`Fecha de impresión: ${new Date().toLocaleDateString('es-CO')}`, 210 - margen, 21, { align: 'right' });

  y = 40;
  doc.setTextColor(30, 30, 30);

  // ---- NÚMERO DE CASO ----
  doc.setFillColor(240, 253, 252);
  doc.roundedRect(margen, y, ancho, 14, 3, 3, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(42, 157, 143);
  doc.text(`Caso: ${caso.numero_caso}`, margen + 4, y + 9);

  // Estado
  const estadoColor = { Pendiente: [230, 81, 0], En_proceso: [21, 101, 192], Resuelto: [46, 125, 50], Rechazado: [214, 64, 69] };
  const color = estadoColor[caso.estado] || [50, 50, 50];
  doc.setFontSize(10);
  doc.setTextColor(...color);
  doc.setFont('helvetica', 'bold');
  doc.text(labelEstado(caso.estado), 210 - margen - 4, y + 9, { align: 'right' });

  y += 20;

  // ---- SECCIONES ----
  function seccion(titulo, campos) {
    doc.setFillColor(78, 205, 196);
    doc.rect(margen, y, ancho, 7, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(titulo.toUpperCase(), margen + 3, y + 5);
    y += 10;

    doc.setTextColor(30, 30, 30);
    campos.forEach(([label, value]) => {
      if (y > 270) { doc.addPage(); y = margen; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(label + ':', margen, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(value || '—'), ancho - 45);
      doc.text(lines, margen + 42, y);
      y += lines.length * 5 + 2;
    });
    y += 4;
  }

  seccion('Datos del Cliente', [
    ['Nombre',   caso.nombre_cliente],
    ['Cédula / NIT', caso.cedula || '—'],
    ['Teléfono', caso.telefono_cliente || '—'],
    ['Correo',   caso.correo_cliente || '—'],
    ['Fecha de registro', formatFecha(caso.fecha_registro)]
  ]);

  seccion('Clasificación', [
    ['Tipo de solicitud', labelTipo(caso.tipo_solicitud)],
    ['Área responsable', labelArea(caso.area_responsable)],
    ['Prioridad', labelPrioridad(caso.prioridad)]
  ]);

  seccion('Descripción del Caso', [
    ['Motivo', caso.motivo],
    ['Descripción', caso.descripcion],
    ['Comentarios adicionales', caso.comentarios_adicionales || '—']
  ]);

  if (caso.solucion) {
    seccion('Solución', [
      ['Solución', caso.solucion],
      ['Fecha resolución', formatFecha(caso.fecha_resolucion)]
    ]);
  }

  // ---- PIE DE PÁGINA ----
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Repostería Pepo's Cake - Sistema PQRS", margen, 290);
    doc.text(`Pág. ${i} / ${totalPages}`, 210 - margen, 290, { align: 'right' });
  }

  doc.save(`PQRS_${caso.numero_caso}.pdf`);
}

// ============================================================
// ELIMINAR PQRS (soft delete)
// ============================================================
async function eliminarPQRS(db, id) {
  const confirmar = confirm(
    '¿Estás seguro de que deseas ELIMINAR este PQRS?\n\nEl caso se moverá a la papelera y podrás restaurarlo desde "Ver Eliminados".'
  );
  if (!confirmar) return;

  const btn = document.getElementById('btnEliminar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Eliminando...'; }

  const { data: { user } } = await db.auth.getUser();
  const eliminadoPor = user?.email || user?.id || 'Desconocido';

  const { error } = await db
    .from('pqrs')
    .update({
      eliminado: true,
      eliminado_en: new Date().toISOString(),
      eliminado_por: eliminadoPor,
    })
    .eq('id', id);

  if (error) {
    alert('❌ Error al eliminar: ' + error.message);
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ Eliminar'; }
    return;
  }

  // Verificar que realmente se guardó (RLS puede bloquear sin error)
  const { data: verificacion } = await db
    .from('pqrs').select('eliminado').eq('id', id).single();

  if (!verificacion || verificacion.eliminado !== true) {
    alert('❌ No se pudo eliminar. Puede ser un problema de permisos en la base de datos.\n\nAsegúrate de haber ejecutado el SQL de permisos en Supabase.');
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ Eliminar'; }
    return;
  }

  if (btn) { btn.textContent = '✅ Eliminado'; btn.className = 'btn btn-success btn-sm'; }
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:1.5rem;left:50%;transform:translateX(-50%);background:#2e7d32;color:#fff;padding:0.9rem 2rem;border-radius:8px;font-weight:700;font-size:1rem;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.25);';
  toast.textContent = '✅ PQRS eliminado y movido a la papelera.';
  document.body.appendChild(toast);
  setTimeout(() => { window.location.href = 'lista-pqrs.html?eliminado=1'; }, 1800);
}

// ---- Anillo SLA del hero ----
function renderSlaRing(data) {
  const el = document.getElementById('d-hero-sla');
  if (!el) return;
  const cerrado = data.estado === 'Resuelto' || data.estado === 'Rechazado';
  if (cerrado) {
    el.innerHTML = `<span class="sla-ring-cap"><i class="bi bi-check-circle-fill"></i> ${labelEstado(data.estado)}</span>`;
    return;
  }
  const horas = (CONFIG.SLA_HORAS && CONFIG.SLA_HORAS[data.tipo_solicitud]) || 120;
  const transcurridas = (Date.now() - new Date(data.fecha_registro).getTime()) / 3600000;
  const restantes = horas - transcurridas;
  const vencido = restantes <= 0;
  const frac = vencido ? 1 : Math.max(0, Math.min(1, restantes / horas));
  const color = vencido ? '#D64045' : (restantes < 24 ? '#E0A82E' : '#7DCFB6');
  const r = 42, cx = 48, cy = 48, circ = 2 * Math.PI * r;
  const dash = circ * frac;
  const texto = vencido ? 'Vencido' : (restantes < 24 ? `${Math.ceil(restantes)}h` : `${Math.ceil(restantes / 24)}d`);
  el.innerHTML = `
    <div class="sla-ring">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(245,235,216,0.15)" stroke-width="7"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="7"
          stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"/>
      </svg>
      <div class="sla-ring-text"><strong>${texto}</strong>${vencido ? '' : '<small>restantes</small>'}</div>
    </div>
    <span class="sla-ring-cap">SLA ${horas}h</span>`;
}

// ---- HELPERS ----
function setDetalle(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '—';
}

function escapeHtml(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
