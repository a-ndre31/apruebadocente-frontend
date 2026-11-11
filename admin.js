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

  // [NUEVO · TAREA 4] Muestra cuándo vence la licencia recién creada (dato real del servidor)
  const venceEl = $('codigo-vence');
  if (venceEl) {
    venceEl.classList.add('hidden');
    try {
      const { data: v } = await obtenerSupabase().rpc('consultar_vencimiento', { p_codigo: codigo });
      if (v && v.fecha_vencimiento) {
        const seg = Number(v.segundos_restantes) || 0;
        venceEl.textContent = esDemo
          ? '⏱ Vence en ' + (seg <= 3700 ? '1 hora' : formatearVencimiento(seg)) + ' (' + formatearFechaHoraDDMMAAAA(v.fecha_vencimiento) + ')'
          : '📅 Vence en ' + formatearVencimiento(seg) + ' (' + formatearFechaDDMMAAAA(v.fecha_vencimiento) + ')';
        venceEl.classList.remove('hidden');
      }
    } catch (_) {}
  }
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

// [NUEVO · TAREA 4] Chip de estado/vigencia de una licencia. Si faltan datos (fallback) muestra "—".
function renderEstadoLicencia(u) {
  if (u.vencida === undefined || u.vencida === null) return '—';
  const seg = Number(u.segundos_restantes) || 0;
  if (u.vencida) return '<span class="chip-vencida">○ Vencida</span>';
  if (u.es_demo) return '<span class="chip-demo">🧪 Demo · ' + esc(formatearVencimiento(seg)) + '</span>';
  if (seg < 7 * 24 * 3600) return '<span class="chip-por-vencer">⚠ Por vencer · ' + esc(formatearVencimiento(seg)) + '</span>';
  return '<span class="chip-ok">● Activa · ' + esc(formatearVencimiento(seg)) + '</span>';
}

// [NUEVO · TAREA 4] Lista docentes con vigencia (admin_estado_licencias) y, si falla, cae a listar_usuarios.
async function cargarUsuariosAdmin() {
  const tbody = $('admin-usuarios-body');
  if (!tbody || !adminClave) return;
  tbody.innerHTML = '<tr><td colspan="8">Cargando directorio...</td></tr>';

  try {
    const sb = obtenerSupabase();

    let data = null;
    try {
      const r = await sb.rpc('admin_estado_licencias', { p_clave: adminClave });
      if (r.error || !Array.isArray(r.data)) throw (r.error || new Error('sin datos'));
      data = r.data;
    } catch (e) {
      console.warn('admin_estado_licencias no disponible; se usa listar_usuarios:', e);
      const r2 = await sb.rpc('listar_usuarios', { p_clave: adminClave });
      if (r2.error || !r2.data) {
        tbody.innerHTML = '<tr><td colspan="8">Error al cargar usuarios.</td></tr>';
        return;
      }
      data = r2.data;
    }

    // Consentimientos (si la migración aún no se ejecutó, no rompe la tabla)
    let consent = {};
    try {
      const rc = await sb.rpc('listar_consentimientos', { p_clave: adminClave });
      (rc.data || []).forEach(c => { consent[c.licencia_codigo] = c.consentimiento_fecha; });
    } catch (_) {}

    tbody.innerHTML = data.map(u => {
      const esDemo = (u.es_demo !== undefined && u.es_demo !== null) ? !!u.es_demo : String(u.codigo).startsWith(DEMO_PREFIJO);
      const venceEl = u.fecha_vencimiento ? esc(formatearFechaHoraDDMMAAAA(u.fecha_vencimiento)) : '—';
      const intentos = (u.intentos_count === undefined || u.intentos_count === null) ? '—' : u.intentos_count;
      const fechaC = u.consentimiento_fecha || consent[u.codigo];
      const cod = esc(u.codigo);
      return `
      <tr>
        <td><strong>${cod}</strong><br><small>${esc(u.cliente)}</small></td>
        <td>Fase ${esc(u.fase)}</td>
        <td>${esc(u.asignatura)}</td>
        <td>${venceEl}</td>
        <td>${renderEstadoLicencia(Object.assign({}, u, { es_demo: esDemo }))}</td>
        <td>${esc(intentos)}</td>
        <td>${fechaC ? '✓ ' + esc(formatearFechaDDMMAAAA(fechaC)) : '—'}</td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="adminImprimirAvance('${cod}')" aria-label="Imprimir avance de ${cod}">🖨 Imprimir</button>
            <button class="btn btn-outline" style="padding:4px 8px; font-size:12px;" onclick="adminCerrarSesionDocente('${cod}')" aria-label="Cerrar sesión de ${cod} en todos sus dispositivos">🔓 Cerrar sesión</button>
            <button class="btn btn-primary" style="padding:4px 8px; font-size:12px;" onclick="adminRenovarLicencia('${cod}', ${esDemo})" aria-label="Renovar licencia de ${cod} por 3 meses" title="Extiende la vigencia 3 meses más">🔄 Renovar 3 meses</button>
            <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="adminBorrarDocente('${cod}', ${Number(u.intentos_count) || 0})" aria-label="Eliminar docente ${cod}">🗑 Eliminar</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8">Error de servidor.</td></tr>';
  }
}

// [NUEVO · TAREA 3] Toast discreto en la esquina inferior derecha (se desvanece en 3 s).
function mostrarToast(mensaje, tipo = 'ok') {
  const t = document.createElement('div');
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.textContent = mensaje;
  t.style.cssText = 'position:fixed; right:20px; bottom:20px; z-index:10000; max-width:320px; padding:12px 16px; border-radius:12px; '
    + 'color:#fff; font:600 14px Inter, sans-serif; box-shadow:0 8px 24px rgba(0,0,0,.25); opacity:1; transition:opacity .5s ease; '
    + 'background:' + (tipo === 'error' ? 'var(--er)' : (tipo === 'info' ? '#64748b' : 'var(--okd)')) + ';';   // [NUEVO · TAREA 4] tipo info
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; }, 2500);
  setTimeout(() => { t.remove(); }, 3000);
}

// [NUEVO · TAREA 3] Elimina UN docente y todos sus datos (confirmación de un clic).
let borrandoDocente = false;
async function adminBorrarDocente(codigo, intentosCount) {
  if (borrandoDocente) return;
  let msg = `¿Eliminar al docente "${codigo}" y TODOS sus datos?`;
  if (intentosCount > 0) msg += `\n\nEste docente tiene ${intentosCount} intentos registrados que también se borrarán.`;
  msg += `\n\nEsta acción NO se puede deshacer.`;
  if (!confirm(msg)) return;

  borrandoDocente = true;
  try {
    const { data, error } = await obtenerSupabase().rpc('admin_borrar_licencia', { p_clave: adminClave, p_codigo: codigo });
    if (error) throw error;
    if (data && data.exito) {
      mostrarToast('✓ Docente eliminado: ' + codigo, 'ok');
      await cargarUsuariosAdmin();   // solo las tablas, sin recargar la página
      cargarStatsAdmin();
    } else {
      alert((data && data.mensaje) || 'No se pudo eliminar al docente.');
    }
  } catch (e) {
    alert('Error al eliminar al docente.');
  } finally {
    borrandoDocente = false;
  }
}

// [NUEVO · TAREA 3] Borra TODOS los intentos y respuestas (pide tipear BORRAR-HISTORIAL).
async function adminBorrarTodoHistorial() {
  const txt = prompt('Vas a borrar TODOS los intentos y respuestas de TODOS los docentes. Esto NO se puede deshacer.\n\nPara confirmar, escribe exactamente: BORRAR-HISTORIAL');
  if (txt !== 'BORRAR-HISTORIAL') return;

  try {
    const { data, error } = await obtenerSupabase().rpc('admin_borrar_historial', {
      p_clave: adminClave,
      p_confirmacion: 'BORRAR-HISTORIAL'
    });
    if (error) throw error;
    if (data && data.exito) {
      alert(`Se borraron ${data.intentos_borrados} intentos y ${data.respuestas_borradas} respuestas.`);
      cargarUsuariosAdmin();
      cargarResultadosRecientesAdmin();
      cargarStatsAdmin();
    } else {
      alert((data && data.mensaje) || 'No se pudo borrar el historial.');
    }
  } catch (e) {
    alert('Error al borrar el historial.');
  }
}

// [NUEVO · TAREA 3] Reporte imprimible del avance de un docente.
async function adminImprimirAvance(codigo) {
  try {
    const { data, error } = await obtenerSupabase().rpc('admin_historial_por_licencia', { p_clave: adminClave, p_codigo: codigo });
    if (error) throw error;
    if (!data || !data.exito) {
      alert((data && data.mensaje) || 'No se pudo obtener el historial.');
      return;
    }
    const filas = data.filas || [];
    if (!filas.length) {
      alert('Este docente no tiene evaluaciones registradas.');
      return;
    }

    const ahora = new Date();
    const hhmm = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
    const emision = formatearFechaDDMMAAAA(ahora.toISOString());   // definida en app.js
    const etiquetaTipo = t => t === 'diagnostico' ? 'Diagnóstico' : (t === 'simulacro' ? 'Simulacro' : t);
    const celda = 'border:1px solid #cbd5e1; padding:6px 8px; text-align:left; font-size:13px;';

    const filasHtml = filas.map(r => `
      <tr>
        <td style="${celda}">${esc(new Date(r.fecha).toLocaleDateString('es-EC'))}</td>
        <td style="${celda}">${esc(etiquetaTipo(r.tipo))}</td>
        <td style="${celda}">Fase ${esc(r.fase)}</td>
        <td style="${celda}">${esc(r.asignatura)}</td>
        <td style="${celda}"><strong>${esc(r.puntaje)}</strong></td>
        <td style="${celda}">${r.aprobado ? 'Aprobado' : 'Reprobado'}</td>
        <td style="${celda}">${r.tiempo_usado_seg ? esc(formatearTiempo(r.tiempo_usado_seg)) : '—'}</td>
      </tr>`).join('');

    $('area-impresion').innerHTML = `
      <div style="font-family:Inter, Arial, sans-serif; color:#0f172a;">
        <h1 style="font-size:20px; margin:0 0 12px;">ApruebaDocente · Reporte de avance</h1>
        <p style="font-size:14px; margin:0 0 4px;"><strong>Docente:</strong> ${esc(codigo)}</p>
        <p style="font-size:14px; margin:0 0 4px;"><strong>Fase y asignatura:</strong> Fase ${esc(filas[0].fase)} · ${esc(filas[0].asignatura)}</p>
        <p style="font-size:14px; margin:0 0 16px;"><strong>Fecha de emisión:</strong> ${esc(emision)}</p>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="${celda}">Fecha</th><th style="${celda}">Tipo</th><th style="${celda}">Fase</th>
              <th style="${celda}">Asignatura</th><th style="${celda}">Puntaje</th><th style="${celda}">Resultado</th><th style="${celda}">Tiempo</th>
            </tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>
        <p style="font-size:12px; color:#64748b; margin-top:20px;">Generado el ${esc(emision)} ${esc(hhmm)} · Documento de seguimiento pedagógico</p>
      </div>`;

    const limpiar = () => { $('area-impresion').innerHTML = ''; window.onafterprint = null; };
    window.onafterprint = limpiar;
    window.print();
  } catch (e) {
    alert('Error al preparar el reporte de avance.');
  }
}

// [NUEVO · TAREA 4] Renueva 3 meses una licencia real (no borra historial ni cierra la sesión).
async function adminRenovarLicencia(codigo, esDemo) {
  if (esDemo) {
    alert('Las licencias de prueba no se renuevan. Crea una licencia real.');
    return;
  }
  if (!confirm(`¿Renovar "${codigo}" 3 meses más?\n\n· Si aún no venció, se suman a los días restantes.\n· Si ya venció, cuentan desde hoy.\n\nNO borra historial ni cierra sesión.`)) return;

  try {
    const { data, error } = await obtenerSupabase().rpc('admin_renovar_licencia', { p_clave: adminClave, p_codigo: codigo });
    if (error) throw error;
    if (data && data.exito) {
      mostrarToast('✓ Renovada hasta ' + formatearFechaDDMMAAAA(data.nueva_fecha_vencimiento), 'ok');
      cargarUsuariosAdmin();
    } else {
      alert((data && data.mensaje) || 'No se pudo renovar la licencia.');
    }
  } catch (e) {
    alert('Error al renovar la licencia.');
  }
}

// [NUEVO · TAREA 4] Cierra la sesión del docente en todos sus dispositivos (reemplaza a "Liberar").
async function adminCerrarSesionDocente(codigo) {
  if (!confirm(`¿Cerrar la sesión de "${codigo}" en todos sus dispositivos?\n\nPodrá volver a entrar desde cualquier dispositivo con su código. No se borra nada.`)) return;

  try {
    const { data, error } = await obtenerSupabase().rpc('admin_liberar_sesion', { p_clave: adminClave, p_codigo: codigo });
    if (error) throw error;
    if (data && data.exito) {
      if (data.habia_sesion === false) mostrarToast('El docente no tenía sesión activa', 'info');
      else mostrarToast('✓ Sesión cerrada: ' + codigo, 'ok');
      cargarUsuariosAdmin();
    } else {
      alert((data && data.mensaje) || 'No se pudo cerrar la sesión.');
    }
  } catch (e) {
    alert('Error al cerrar la sesión.');
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