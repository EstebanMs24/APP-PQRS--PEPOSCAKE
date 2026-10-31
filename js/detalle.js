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

  withReader(async (db) => {
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
  let editLink=document.getElementById('editarCaso');
  if(!editLink){editLink=document.createElement('a');editLink.id='editarCaso';editLink.className='btn btn-outline btn-sm';editLink.textContent='Editar caso';document.querySelector('.topbar-actions').prepend(editLink);}
  editLink.href=`nuevo-pqrs.html?id=${data.id}`;editLink.hidden=!!data.eliminado || !tieneRol('admin');


  // Clonar template
  const template = document.getElementById('templateDetalle');
  const clone = template.content.cloneNode(true);
  mainEl.innerHTML = '';
  mainEl.appendChild(clone);
  // Apply permissions before waiting for private evidence URLs to load.
  updateRoleBasedElements();
  if (data.eliminado || !tieneRol('admin')) {
    document.getElementById('formActualizarEstado')?.setAttribute('hidden', '');
    document.getElementById('btnEliminar')?.setAttribute('hidden', '');
  }

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

      gridEv.replaceChildren();
      for (const reference of data.imagenes) {
        try {
          const url=await Data.evidenceUrl(db,reference);
          const a=document.createElement('a'), img=document.createElement('img');
          a.href=url; a.target='_blank'; a.rel='noopener noreferrer';
          img.src=url; img.alt='Evidencia privada'; img.className='evidencia-img'; img.loading='lazy';
          a.append(img); gridEv.append(a);
          a.addEventListener('click',async event=>{
            event.preventDefault();
            const tab=window.open('about:blank','_blank'); if(tab)tab.opener=null;
            try { const fresh=await Data.evidenceUrl(db,reference); if(tab)tab.location.replace(fresh);else{a.href=fresh;Utils.showToast('Permite abrir ventanas o abre el enlace en una nueva pestaña.','info');} }
            catch { tab?.close();Utils.showToast('No se pudo abrir la evidencia. Recarga el caso.','error'); }
          });
        } catch { const message=document.createElement('p'); message.textContent='No se pudo cargar una evidencia. Recarga para reintentar.'; gridEv.append(message); }
      }
    }
  }

  // Establecer estado actual en el select
  const selectEstado = document.getElementById('nuevoEstado');
  if (selectEstado) selectEstado.value = data.estado;
  if(document.getElementById('textoSolucion'))document.getElementById('textoSolucion').value=data.solucion||'';

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

  updateRoleBasedElements();
  if(data.eliminado || !tieneRol('admin')) { document.getElementById('formActualizarEstado')?.setAttribute('hidden','');document.getElementById('btnEliminar')?.setAttribute('hidden',''); }
  // Cargar historial
  await cargarHistorial(db, id);
}

async function actualizarEstado(e, db, id) {
  e.preventDefault();
  const btn = document.getElementById('btnActualizar');
  const alertEl = document.getElementById('alertEstado');
  if (btn.disabled) return;

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


  try {
    await requireAdmin(db);
    const { data, error } = await db.rpc('actualizar_estado_pqrs', {
      p_id:id,p_estado:nuevoEstado,p_comentario:comentario,p_solucion:solucion,p_version:casoActual.actualizado_en
    });
    if(error || !data) throw new Error(error?.code==='40001' ? 'El caso cambió. Recarga antes de guardar.' : 'No se pudo guardar el estado y el seguimiento.');
    Utils.showToast('Estado y seguimiento guardados.');
    await cargarDetalle(db,id);
  } catch(error) {
    alertEl.className='alert alert-error'; alertEl.textContent=error.message; alertEl.style.display='block';
  } finally { btn.disabled=false; btn.textContent='Actualizar estado'; }
}

async function cargarHistorial(db, id) {
  const timeline = document.getElementById('timeline');
  if (!timeline) return;

  const { data, error } = await db
    .from('seguimiento_pqrs')
    .select('*')
    .eq('pqrs_id', id)
    .order('creado_en', { ascending: false });

  if (error) { timeline.textContent='No se pudo cargar el historial. Recarga para reintentar.'; return; }
  if (!data || data.length === 0) {
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
    if(y>255){doc.addPage();y=margen;}
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
      for(const line of lines){if(y>275){doc.addPage();y=margen;}doc.text(line,margen+42,y);y+=5;}
      y += 2;
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

async function eliminarPQRS(db,id) {
 if(!await Utils.confirmModal({title:'Archivar solicitud',message:'El caso se moverá al archivo. Puedes restaurarlo desde el listado.',confirmText:'Archivar',variant:'danger'}))return;
 const btn=document.getElementById('btnEliminar');if(btn.disabled)return;btn.disabled=true;
 try {
  await requireAdmin(db);
  const {data,error}=await db.from('pqrs').update({eliminado:true}).eq('id',id).select('id').single();
  if(error||!data)throw new Error('No se pudo confirmar el archivado.');
  Utils.showToast('Solicitud archivada.');window.location.assign('lista-pqrs.html?eliminado=1');
 }catch(error){Utils.showToast(error.message,'error');}finally{btn.disabled=false;}
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

  const sla=Utils.calcularEstadoSLA(data);if(!sla){el.textContent='Sin plazo definido';return;}
  const horas=sla.horasTotales,restantes=sla.horasRestantes,vencido=sla.nivel==='vencido';
  const frac=vencido?1:Math.max(0,Math.min(1,restantes/horas));
  const color=vencido?'#D64045':sla.nivel==='warning'?'#E0A82E':'#7DCFB6';
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
