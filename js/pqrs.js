// ============================================================
// PQRS.JS - Registro de nuevo PQRS
// ============================================================

// ---- Tags widget ----
const tagsArray = [];

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
      if (selectedFiles.length >= 5) return;
      if (file.size > 5 * 1024 * 1024) { alert(`"${file.name}" supera 5 MB.`); return; }
      if (!file.type.startsWith('image/')) return;
      selectedFiles.push(file);
      const idx = selectedFiles.length - 1;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const item = document.createElement('div');
        item.className = 'file-preview-item';
        item.dataset.idx = idx;
        item.innerHTML = `<img src="${ev.target.result}" alt="preview" /><button type="button" class="file-preview-remove" title="Quitar">✕</button>`;
        item.querySelector('.file-preview-remove').addEventListener('click', () => {
          selectedFiles.splice(idx, 1);
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
});

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardar');
  clearErrors();

  const data = getFormData();
  if (!validateForm(data)) return;

  setLoading(btn, true);

  withSupabase(async (db) => {
    const user = await getCurrentUser();

    // Upload images first
    const imageUrls = [];
    if (selectedFiles.length > 0) {
      for (const file of selectedFiles) {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploadData, error: uploadError } = await db.storage
          .from('evidencias-pqrs')
          .upload(path, file, { cacheControl: '3600', upsert: false });
        if (uploadError) {
          console.warn('Error subiendo imagen:', uploadError.message);
        } else {
          const { data: { publicUrl } } = db.storage.from('evidencias-pqrs').getPublicUrl(path);
          imageUrls.push(publicUrl);
        }
      }
    }

    const payload = {
      numero_caso: '',
      nombre_cliente: data.nombre_cliente,
      telefono_cliente: data.telefono_cliente || null,
      correo_cliente: data.correo_cliente || null,
      tipo_solicitud: data.tipo_solicitud,
      area_responsable: data.area_responsable,
      motivo: data.motivo,
      descripcion: data.descripcion,
      comentarios_adicionales: data.comentarios_adicionales || null,
      estado: 'Pendiente',
      tags: data.tags,
      imagenes: imageUrls,
      creado_por: user ? user.id : null
    };

    const { data: nuevo, error } = await db
      .from('pqrs')
      .insert(payload)
      .select()
      .single();

    if (error) {
      showAlert('formAlert', 'error', 'Error al guardar el PQRS: ' + error.message);
      setLoading(btn, false);
      return;
    }

    showAlert('formAlert', 'success', `✅ PQRS registrado correctamente. Nº ${nuevo.numero_caso}`);
    setTimeout(() => {
      window.location.href = `detalle-pqrs.html?id=${nuevo.id}`;
    }, 1500);
  });
}

function getFormData() {
  const tagsRaw = document.getElementById('tagsHidden')?.value || '[]';
  let tags = [];
  try { tags = JSON.parse(tagsRaw); } catch (e) { tags = []; }
  return {
    nombre_cliente: document.getElementById('nombre_cliente').value.trim(),
    telefono_cliente: document.getElementById('telefono_cliente').value.trim(),
    correo_cliente: document.getElementById('correo_cliente').value.trim(),
    tipo_solicitud: document.getElementById('tipo_solicitud').value,
    area_responsable: document.getElementById('area_responsable').value,
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

  if (!data.tipo_solicitud) {
    showFieldError('tipo_solicitud', 'Selecciona el tipo de solicitud.');
    valid = false;
  }

  if (!data.area_responsable) {
    showFieldError('area_responsable', 'Selecciona el área responsable.');
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

  return valid;
}

function showFieldError(fieldId, message) {
  const el = document.getElementById(`err-${fieldId}`);
  if (el) el.textContent = message;
  const field = document.getElementById(fieldId);
  if (field) field.style.borderColor = 'var(--color-danger)';
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.style.borderColor = '';
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
