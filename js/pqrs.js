// ============================================================
// PQRS.JS - Registro de nuevo PQRS
// ============================================================

// ---- Tags widget ----
const tagsArray = [];
let addExistingTag;
let editContext=null;

function initTagsWidget() {
  const container = document.getElementById('tagsContainer');
  const input = document.getElementById('tagInput');
  const hidden = document.getElementById('tagsHidden');
  if (!container || !input || !hidden) return;

  function addTag(value) {
    const tag = value.trim().replace(/,+$/, '').trim();
    if (!tag || tagsArray.includes(tag) || tagsArray.length >= 10) return;
    tagsArray.push(tag);

    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escapeHtmlLocal(tag)} <button type="button" class="tag-chip-remove" title="Quitar">✕</button>`;
    chip.querySelector('.tag-chip-remove').addEventListener('click', () => {
      chip.remove();
      tagsArray.splice(tagsArray.indexOf(tag), 1);
      hidden.value = JSON.stringify(tagsArray);
    });
    container.insertBefore(chip, input);
    hidden.value = JSON.stringify(tagsArray);
    input.value = '';
  }

  addExistingTag=addTag;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input.value);
    }
    if (e.key === 'Backspace' && input.value === '' && tagsArray.length > 0) {
      container.querySelectorAll('.tag-chip').forEach((c, i, arr) => {
        if (i === arr.length - 1) c.querySelector('.tag-chip-remove').click();
      });
    }
  });

  input.addEventListener('blur', () => {
    if (input.value.trim()) addTag(input.value);
  });

  container.addEventListener('click', () => input.focus());
}

function escapeHtmlLocal(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- File upload widget ----
const selectedFiles = [];

function initFileUpload() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('evidenciasInput');
  const pickerLink = document.getElementById('filePickerLink');
  const previewGrid = document.getElementById('filePreviewGrid');
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('keydown', e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click();}});
  pickerLink?.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('click', (e) => {
    if (e.target !== pickerLink) fileInput.click();
  });

  fileInput.addEventListener('change', () => addFiles(Array.from(fileInput.files)));

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
  });

  function addFiles(files) {
    files.forEach(file => {
      if (selectedFiles.length >= 5) {
        Utils.showToast('Máximo 5 imágenes por PQRS.', 'warning');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        Utils.showToast(`"${file.name}" supera 5 MB.`, 'warning');
        return;
      }
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { Utils.showToast('Solo JPG, PNG o WebP.', 'warning'); return; }
      selectedFiles.push(file);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const item = document.createElement('div');
        item.className = 'file-preview-item';
        item.innerHTML = `<img src="${ev.target.result}" alt="preview" /><button type="button" class="file-preview-remove" title="Quitar imagen">✕</button>`;
        // Quitar usando la identidad del archivo (no un índice fijo que se desactualiza)
        item.querySelector('.file-preview-remove').addEventListener('click', () => {
          const pos = selectedFiles.indexOf(file);
          if (pos > -1) selectedFiles.splice(pos, 1);
          item.remove();
        });
        previewGrid.appendChild(item);
      };
      reader.readAsDataURL(file);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formNuevoPQRS');
  if (!form) return;

  // Contador de caracteres para descripción
  const descripcionEl = document.getElementById('descripcion');
  const charDesc = document.getElementById('charDesc');
  if (descripcionEl && charDesc) {
    descripcionEl.addEventListener('input', () => {
      charDesc.textContent = `${descripcionEl.value.length} / 3000`;
    });
  }

  initTagsWidget();
  initFileUpload();


  form.addEventListener('submit', handleSubmit);
  const editId=new URLSearchParams(location.search).get('id');
  if(editId){
    document.getElementById('btnGuardar').disabled=true;
    withAdmin(async db=>{
      const {data,error}=await db.from('pqrs').select('*').eq('id',editId).single();
      if(error||!data||data.eliminado){Utils.showToast('No se pudo abrir el caso para editar.','error');return;}
      editContext=data;
      for(const key of ['nombre_cliente','cedula','telefono_cliente','correo_cliente','tipo_solicitud','area_responsable','prioridad','motivo','descripcion','comentarios_adicionales']){const el=document.getElementById(key);if(el)el.value=data[key]||'';}
      (data.tags||[]).forEach(tag=>addExistingTag(tag));
      document.querySelector('.page-intro h2').textContent=`Editar ${data.numero_caso}`;
      document.getElementById('btnGuardar').querySelector('.btn-text').textContent='Guardar cambios';
      const note=document.createElement('p');note.className='form-hint';note.textContent=`Se conservan ${(data.imagenes||[]).length} evidencias existentes. Puedes adjuntar otras hasta un total de cinco.`;document.getElementById('filePreviewGrid').before(note);
      document.getElementById('btnGuardar').disabled=false;
    });
  }

});


let formDirty = false;
let savedId = null;
let pendingPayload = null;
let uploadedPaths = [];
window.addEventListener('beforeunload', e => { if (formDirty) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('DOMContentLoaded', () => document.getElementById('formNuevoPQRS')?.addEventListener('input', () => { formDirty = true; }));
async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardar');
  if (new URLSearchParams(location.search).has('id') && !editContext) return;
  if (btn.disabled || savedId) return;
  clearErrors();
  const data = getFormData();
  if (!validateForm(data)) { document.querySelector('[aria-invalid="true"]')?.focus(); return; }
  setLoading(btn, true);
  try {
    const db = await supabaseReady(), user = await requireAdmin(db);
    // Keep the same ID and exact payload on ambiguous network retries: no duplicate cases.
    if ((editContext?.imagenes?.length||0)+selectedFiles.length>5) throw new Error('Máximo cinco evidencias por caso.');
    if (!pendingPayload) {
      for (const file of selectedFiles) {
        const ext = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' }[file.type];
        if (!ext || file.size > CONFIG.MAX_IMAGEN_MB * 1024 * 1024) throw new Error('Usa imágenes JPG, PNG o WebP de hasta 5 MB.');
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await db.storage.from('evidencias-pqrs').upload(path,file,{contentType:file.type,upsert:false});
        if (error) {
          if (uploadedPaths.length) { const cleanup = await db.storage.from('evidencias-pqrs').remove(uploadedPaths); if (cleanup.error) Utils.showToast('Quedaron archivos sin asociar; informa al administrador.', 'warning'); }
          uploadedPaths=[]; throw new Error('No se subieron todas las evidencias. El formulario conserva los datos para reintentar.');
        }
        uploadedPaths.push(path);
      }
      pendingPayload=editContext ? {...data,imagenes:[...(editContext.imagenes||[]),...uploadedPaths]} : {...data,id:crypto.randomUUID(),numero_caso:'',estado:'Pendiente',creado_por:user.id,imagenes:uploadedPaths};
      for(const key of ['cedula','telefono_cliente','correo_cliente','comentarios_adicionales']) pendingPayload[key] ||= null;
    }
    let { data:nuevo,error } = editContext ? await db.from('pqrs').update(pendingPayload).eq('id',editContext.id).eq('actualizado_en',editContext.actualizado_en).select('id,numero_caso').single() : await db.from('pqrs').insert(pendingPayload).select('id,numero_caso').single();
    if (!editContext && error?.code === '23505') {
      const existing = await db.from('pqrs').select('id,numero_caso').eq('id',pendingPayload.id).single();
      if (existing.data) { nuevo=existing.data; error=null; }
    }

    if (editContext && error?.code === 'PGRST116') {
      const actual=await db.from('pqrs').select('*').eq('id',editContext.id).single();
      const same=actual.data && !actual.data.eliminado && Object.entries(pendingPayload).every(([key,value])=>JSON.stringify(actual.data[key])===JSON.stringify(value));
      if(same){nuevo=actual.data;error=null;}
      else throw new Error('El caso cambió desde que lo abriste. Conserva tus cambios y recarga antes de volver a guardar.');
    }
    if (error || !nuevo) {

      if (error?.code && /^(23|42501)/.test(error.code)) {
        // Explicit constraint/authorization rejection: payload can safely be corrected.
        pendingPayload=null;
        // Keep uploaded objects for reconciliation; do not risk deleting a previously committed attachment.
        uploadedPaths=[];
      }
      throw new Error('No se confirmó el guardado. Reintentar verificará el envío anterior; conserva los datos hasta confirmarlo.');
    }
    savedId=nuevo.id; formDirty=false;
    Utils.showToast(`PQRS guardada: ${nuevo.numero_caso}`);
    window.location.assign(`detalle-pqrs.html?id=${nuevo.id}`);
  } catch(error) { Utils.showToast(error.message,'error',{duration:7000}); }
  finally { setLoading(btn,false); }
}

function getFormData() {
  const tagsRaw = document.getElementById('tagsHidden')?.value || '[]';
  let tags = [];
  try { tags = JSON.parse(tagsRaw); } catch (e) { tags = []; }
  return {
    nombre_cliente: document.getElementById('nombre_cliente').value.trim(),
    cedula: document.getElementById('cedula')?.value.trim() || '',
    telefono_cliente: document.getElementById('telefono_cliente').value.trim(),
    correo_cliente: document.getElementById('correo_cliente').value.trim(),
    tipo_solicitud: document.getElementById('tipo_solicitud').value,
    area_responsable: document.getElementById('area_responsable').value,
    prioridad: document.getElementById('prioridad')?.value || 'Media',
    motivo: document.getElementById('motivo').value.trim(),
    descripcion: document.getElementById('descripcion').value.trim(),
    comentarios_adicionales: document.getElementById('comentarios_adicionales').value.trim(),
    tags
  };
}

function validateForm(data) {
  let valid = true;

  if (!data.nombre_cliente) {
    showFieldError('nombre_cliente', 'El nombre del cliente es obligatorio.');
    valid = false;
  }

  if (data.correo_cliente && !isValidEmail(data.correo_cliente)) {
    showFieldError('correo_cliente', 'El correo electrónico no es válido.');
    valid = false;
  }

  if (data.telefono_cliente && !isValidPhone(data.telefono_cliente)) {
    showFieldError('telefono_cliente', 'El teléfono debe tener entre 7 y 10 dígitos.');
    valid = false;
  }

  if (!data.tipo_solicitud) {
    showFieldError('tipo_solicitud', 'Selecciona el tipo de solicitud.');
    valid = false;
  }

  if (!data.area_responsable) {
    showFieldError('area_responsable', 'Selecciona el área responsable.');
    valid = false;
  }

  if (!['Alta', 'Media', 'Baja'].includes(data.prioridad)) {
    showFieldError('prioridad', 'Selecciona una prioridad válida.');
    valid = false;
  }

  if (!data.motivo) {
    showFieldError('motivo', 'El motivo es obligatorio.');
    valid = false;
  }

  if (!data.descripcion || data.descripcion.length < 10) {
    showFieldError('descripcion', 'La descripción debe tener al menos 10 caracteres.');
    valid = false;
  }

  if (data.cedula && !/^[0-9 .-]{5,30}$/.test(data.cedula)) { showFieldError('cedula','Revisa el número de documento.'); valid=false; }
  return valid;
}

function showFieldError(fieldId, message) {
  const el = document.getElementById(`err-${fieldId}`);
  if (el) el.textContent = message;
  const field = document.getElementById(fieldId);
  if (field) { field.style.borderColor = 'var(--color-danger)'; field.setAttribute('aria-invalid','true'); field.setAttribute('aria-describedby',`err-${fieldId}`); }
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.style.borderColor = ''; el.removeAttribute('aria-invalid');
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  if (!phone) return true;
  return /^[+0-9 ()-]+$/.test(phone) && /^\d{7,15}$/.test(phone.replace(/\D/g, ''));
}
