// ============================================================
// USUARIOS.JS - Gestión de usuarios (solo admin)
// Listar, aprobar/desactivar y cambiar rol.
// El acceso a esta página lo restringe auth.js (solo admin).
// ============================================================

let currentDb = null;
let miUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  withSupabase(async (db) => {
    currentDb = db;
    const { data: { user } } = await db.auth.getUser();
    miUserId = user ? user.id : null;

    await cargarUsuarios(db);

    document.getElementById('btnRecargar')?.addEventListener('click', () => cargarUsuarios(db));
  });
});

async function cargarUsuarios(db) {
  const tbody = document.getElementById('tbodyUsuarios');
  if (!tbody) return;

  const { data, error } = await db
    .from('usuarios')
    .select('id, nombre, correo, rol, activo, creado_en')
    .order('creado_en', { ascending: true });

  if (error) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:1.5rem;">Error al cargar usuarios.</td></tr>';
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-mascot">
        <img src="img/mascota-pepo.png?v=10" alt="Mascota Pepo's Cake" />
        <span class="empty-title">Sin usuarios</span>
        <p>Aún no hay usuarios registrados en el sistema.</p>
      </div>
    </td></tr>`;
    actualizarStats([]);
    return;
  }

  actualizarStats(data);

  tbody.innerHTML = data.map(u => {
    const esYo = u.id === miUserId;
    const activo = u.activo !== false;
    const estadoBadge = activo
      ? '<span class="badge badge-Resuelto">Activo</span>'
      : '<span class="badge badge-Pendiente">Pendiente</span>';

    // Selector de rol (deshabilitado en la propia cuenta para evitar auto-degradarse)
    const roles = ['cliente', 'empleado', 'admin'];
    const opciones = roles.map(r =>
      `<option value="${r}" ${u.rol === r ? 'selected' : ''}>${getLabelRol(r)}</option>`
    ).join('');
    const selectRol = `<select class="select-rol" data-id="${u.id}" ${esYo ? 'disabled title="No puedes cambiar tu propio rol"' : ''}>${opciones}</select>`;

    // Botón activar / desactivar (no permitir desactivarse a sí mismo)
    let accion;
    if (esYo) {
      accion = '<span class="text-muted" style="font-size:0.82rem;">Tu cuenta</span>';
    } else if (activo) {
      accion = `<button class="btn btn-outline-danger btn-sm" data-accion="desactivar" data-id="${u.id}" data-nombre="${Utils.escapeHtml(u.nombre)}"><i class="bi bi-pause-circle"></i> Desactivar</button>`;
    } else {
      accion = `<button class="btn btn-success btn-sm" data-accion="activar" data-id="${u.id}" data-nombre="${Utils.escapeHtml(u.nombre)}"><i class="bi bi-check-circle"></i> Aprobar</button>`;
    }

    return `
      <tr>
        <td><strong>${Utils.escapeHtml(u.nombre)}</strong></td>
        <td style="font-size:0.9rem;">${Utils.escapeHtml(u.correo)}</td>
        <td>${selectRol}</td>
        <td>${estadoBadge}</td>
        <td style="white-space:nowrap; font-size:0.88rem;">${Utils.formatFecha(u.creado_en)}</td>
        <td>${accion}</td>
      </tr>
    `;
  }).join('');

  // Bind acciones
  tbody.querySelectorAll('button[data-accion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const activar = btn.dataset.accion === 'activar';
      toggleActivo(db, btn.dataset.id, btn.dataset.nombre, activar);
    });
  });
  tbody.querySelectorAll('.select-rol').forEach(sel => {
    sel.addEventListener('change', () => cambiarRol(db, sel.dataset.id, sel.value, sel));
  });
}

function actualizarStats(data) {
  const total = data.length;
  const activos = data.filter(u => u.activo !== false).length;
  setText('statUsuarios', total);
  setText('statActivos', activos);
  setText('statPendientes', total - activos);
}

async function toggleActivo(db, id, nombre, activar) {
  const accionTxt = activar ? 'aprobar' : 'desactivar';
  if (!confirm(`¿Seguro que deseas ${accionTxt} la cuenta de "${nombre}"?`)) return;

  const { error } = await db.from('usuarios').update({ activo: activar }).eq('id', id);
  if (error) {
    Utils.showToast('No se pudo actualizar: ' + error.message, 'error');
    return;
  }
  Utils.showToast(
    activar ? `Cuenta de ${nombre} aprobada.` : `Cuenta de ${nombre} desactivada.`,
    activar ? 'success' : 'warning'
  );
  await cargarUsuarios(db);
}

async function cambiarRol(db, id, nuevoRol, selectEl) {
  const { error } = await db.from('usuarios').update({ rol: nuevoRol }).eq('id', id);
  if (error) {
    Utils.showToast('No se pudo cambiar el rol: ' + error.message, 'error');
    await cargarUsuarios(db); // revertir visualmente
    return;
  }
  Utils.showToast(`Rol actualizado a ${getLabelRol(nuevoRol)}.`, 'success');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
