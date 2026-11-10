/* =====================================================================
   admin.js · PANEL DE ADMINISTRADOR: acceso (RPC admin_verificar), pestañas,
   asignación de fase/asignatura al crear licencias (RPC crear_licencia),
   usuarios, resultados, estadísticas y fallos.
   La fase y la asignatura se guardan en Supabase (tabla licencias), NO en localStorage.
   Depende de app.js (adminClave, obtenerSupabase, ASIGNATURAS_POR_FASE, esc).
   ===================================================================== */
let usuarioGeneradoTemp = '';

/* ---------- 11. CENTRO DE ADMINISTRACIÓN (B5) ---------- */
function accederAdmin(e) {
  if (e) e.preventDefault();
  const d = $('modal-admin');
  $('admin-clave-error').classList.add('hidden');
  $('admin-clave-input').value = '';
  if (!d.open) d.showModal();
  $('admin-clave-input').focus();
}

function cerrarModalAdmin() { $('modal-admin').close(); }

function mostrarErrorAdmin(msg) {
  const err = $('admin-clave-error');
  err.textContent = msg;
  err.classList.remove('hidden');
}

async function adminLogin(e) {
  e.preventDefault();
  const clave = $('admin-clave-input').value;
  const btn = $('btn-admin-verificar');
  $('admin-clave-error').classList.add('hidden');

  if (!clave) { mostrarErrorAdmin('Introduce la clave de administrador.'); return false; }
  btn.disabled = true;
  btn.textContent = 'Verificando...';

  try {
    const { data, error } = await obtenerSupabase().rpc('admin_verificar', { p_clave: clave });
    if (error) throw error;
    if (data === true) {
      adminClave = clave; 
      $('modal-admin').close();
      mostrarPantalla('pantalla-admin');
      cambiarTabAdmin('resumen');
    } else {
      mostrarErrorAdmin('Clave incorrecta.');
    }
  } catch (ex) {
    console.error(ex);
    mostrarErrorAdmin('No se pudo verificar la clave. Confirma que la función admin_verificar esté instalada.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verificar';
    $('admin-clave-input').value = '';
  }
  return false;
}

function salirAdmin() {
  adminClave = null;
  mostrarPantalla('pantalla-inicio');
}

function cambiarTabAdmin(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('activa', t.dataset.tab === tab));
  document.querySelectorAll('.admin-seccion').forEach(s => s.classList.toggle('activa', s.id === 'admin-' + tab));

  if (tab === 'crear') actualizarAsignaturasAdmin();
  if (tab === 'usuarios') cargarUsuariosAdmin();
  if (tab === 'resultados') cargarResultadosRecientesAdmin();
  if (tab === 'stats') cargarStatsAdmin();
  if (tab === 'fallos') cargarFallosAdmin();
}

function actualizarAsignaturasAdmin() {
  const faseInput = $('admin-fase');
  const sel = $('admin-asignatura');
  if (!faseInput || !sel) return;

  const fase = faseInput.value;
  sel.innerHTML = '<option value="">— Seleccione asignatura —</option>';

  if (!fase || !ASIGNATURAS_POR_FASE[fase]) {
    sel.innerHTML = '<option value="">— Primero elija fase —</option>';
    return;
  }

  ASIGNATURAS_POR_FASE[fase].forEach(a => {
    const o = document.createElement('option');
    o.value = a;
    o.textContent = a;
    sel.appendChild(o);
  });
}

function generarUsuario(nombre) {
  const limpio = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
  const base = limpio.length >= 2 ? limpio[0] + '.' + limpio[limpio.length - 1] : (limpio[0] || 'docente');
  return base + '-' + Math.random().toString(36).substring(2, 6);
}

async function generarUsuarioAdmin() {
  const nombre = ($('admin-nombre').value || '').trim();
  const fase = $('admin-fase').value;
  const asignatura = $('admin-asignatura').value;
  const alerta = $('admin-crear-alerta');
  if (alerta) alerta.classList.add('hidden');

  if (!nombre || !fase || !asignatura) {
    if (alerta) {
      alerta.textContent = 'Por favor completa el nombre, la fase y la asignatura.';
      alerta.classList.remove('hidden');
    }
    return;
  }

  const codigo = generarUsuario(nombre);
  await guardarLicenciaEnSistema(codigo, nombre, fase, asignatura, false);
}

async function generarUsuarioTemporal() {
  const nombre = ($('admin-nombre').value || '').trim();
  const fase = $('admin-fase').value;
  const asignatura = $('admin-asignatura').value;
  const alerta = $('admin-crear-alerta');
  if (alerta) alerta.classList.add('hidden');

  if (!nombre || !fase || !asignatura) {
    if (alerta) {
      alerta.textContent = 'Para crear un acceso de demostración debes ingresar nombre, fase y asignatura.';
      alerta.classList.remove('hidden');
    }
    return;
  }

  const baseNombre = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/)[0] || 'demo';
  const codigo = 'prueba-' + baseNombre + '-' + Math.random().toString(36).substring(2, 6);

  await guardarLicenciaEnSistema(codigo, nombre + ' (Demo)', fase, asignatura, true);
}

async function guardarLicenciaEnSistema(codigo, cliente, fase, asignatura, esDemo) {
  usuarioGeneradoTemp = codigo;

  try {
    const { data, error } = await obtenerSupabase().rpc('crear_licencia', {
      p_clave: adminClave,
      p_codigo: codigo,
      p_cliente: cliente,
      p_fase: parseInt(fase),
      p_asignatura: asignatura
    });

    if (error || (data && !data.exito)) {
      alert((data && data.mensaje) || 'Error al guardar licencia.');
      return;
    }
  } catch (e) {
    alert('Excepción al conectar con Supabase.');
    return;
  }

  $('usuario-codigo').textContent = codigo;
  $('codigo-generado-label').textContent = esDemo ? 'Usuario temporal de prueba:' : 'Usuario creado:';

  const notaTemp = $('nota-temporal');
  if (notaTemp) {
    if (esDemo) notaTemp.classList.remove('hidden');
    else notaTemp.classList.add('hidden');
  }

  $('codigo-generado').classList.add('visible');
}

function copiarUsuario() {
  if (usuarioGeneradoTemp) {
    navigator.clipboard.writeText(usuarioGeneradoTemp).then(() => alert('Copiado: ' + usuarioGeneradoTemp));
  }
}

function enviarWhatsApp() {
  if (usuarioGeneradoTemp) {
    window.open('https://wa.me/?text=' + encodeURIComponent('Tu usuario para ApruebaDocente es:\n\n' + usuarioGeneradoTemp), '_blank');
  }
}

async function cargarUsuariosAdmin() {
  const tbody = $('admin-usuarios-body');
  if (!tbody || !adminClave) return;
  tbody.innerHTML = '<tr><td colspan="6">Cargando directorio...</td></tr>';

  try {
    const { data, error } = await obtenerSupabase().rpc('listar_usuarios', { p_clave: adminClave });
    if (error || !data) {
      tbody.innerHTML = '<tr><td colspan="6">Error al cargar usuarios.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(u => `
      <tr>
        <td><strong>${esc(u.codigo)}</strong><br><small>${esc(u.cliente)}</small></td>
        <td>Fase ${u.fase}</td>
        <td>${esc(u.asignatura)}</td>
        <td>${u.intentos_count}</td>
        <td><span style="color:${u.activo ? 'var(--ok)' : 'var(--mu)'}; font-weight:700;">${u.activo ? '● Activa' : '○ Inactiva'}</span></td>
        <td>
          ${u.activo ? `<button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="liberarSesionAdmin('${u.codigo}')">Liberar</button>` : '—'}
        </td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6">Error de servidor.</td></tr>';
  }
}

async function liberarSesionAdmin(codigo) {
  if (!confirm(`¿Deseas liberar la sesión del usuario ${codigo}?`)) return;
  try {
    const { data } = await obtenerSupabase().rpc('liberar_sesion', { p_clave: adminClave, p_codigo: codigo });
    if (data && data.exito) {
      alert('Sesión liberada.');
      cargarUsuariosAdmin();
    }
  } catch (e) {
    alert('Error al liberar sesión.');
  }
}

async function cargarResultadosRecientesAdmin() {
  const tbody = $('admin-resultados-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Cargando resultados...</td></tr>';

  try {
    const { data, error } = await obtenerSupabase()
      .from('intentos')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(30);

    if (error || !data) {
      tbody.innerHTML = '<tr><td colspan="6">Sin datos de actividad.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr>
        <td>${new Date(r.fecha).toLocaleDateString('es-EC')}</td>
        <td>${esc(r.licencia_codigo)}</td>
        <td>Fase ${r.fase}</td>
        <td>${esc(r.asignatura)}</td>
        <td><strong>${r.puntaje}</strong></td>
        <td><span style="color:${r.aprobado ? 'var(--ok)' : 'var(--er)'}; font-weight:700;">${r.aprobado ? 'Aprobado' : 'Reprobado'}</span></td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6">Error al cargar resultados.</td></tr>';
  }
}

async function cargarStatsAdmin() {
  try {
    const { data: intentos } = await obtenerSupabase().from('intentos').select('puntaje, aprobado, fase, asignatura');
    if (!intentos) return;

    const total = intentos.length;
    const aprobados = intentos.filter(i => i.aprobado).length;
    const sumaPuntaje = intentos.reduce((acc, i) => acc + i.puntaje, 0);
    const promedio = total > 0 ? Math.round(sumaPuntaje / total) : 0;

    $('stat-total').textContent = total;
    $('stat-aprobados').textContent = aprobados;
    $('stat-promedio').textContent = promedio;

    const r1 = intentos.filter(i => i.puntaje < 500).length;
    const r2 = intentos.filter(i => i.puntaje >= 500 && i.puntaje < 701).length;
    const r3 = intentos.filter(i => i.puntaje >= 701 && i.puntaje < 900).length;
    const r4 = intentos.filter(i => i.puntaje >= 900).length;

    $('stats-rangos').innerHTML = `
      <tr><td>Insuficiente (&lt; 500)</td><td>${r1}</td></tr>
      <tr><td>En Desarrollo (500 - 700)</td><td>${r2}</td></tr>
      <tr><td>Satisfactorio (701 - 899)</td><td>${r3}</td></tr>
      <tr><td>Excelente (900 - 1000)</td><td>${r4}</td></tr>`;
  } catch (e) {}
}

async function cargarFallosAdmin() {
  const tbody = $('admin-fallos-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">Cargando métricas...</td></tr>';

  try {
    const { data, error } = await obtenerSupabase().from('preguntas_stats').select('*').order('veces_fallada', { ascending: false }).limit(20);
    if (error || !data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="4">No hay datos de preguntas falladas.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(f => `
      <tr>
        <td><strong>${esc(f.pregunta_id)}</strong></td>
        <td>Fase ${f.fase || 1}</td>
        <td>${esc(f.tema || 'General')} <br><small style="color:var(--mu);">${esc(f.subtema || '')}</small></td>
        <td><strong style="color:var(--er);">${f.veces_fallada}</strong></td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4">Error cargando fallos.</td></tr>';
  }
}