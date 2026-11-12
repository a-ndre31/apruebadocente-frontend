/* =====================================================================
   admin.js · PANEL DE ADMINISTRADOR (Versión Definitiva con Canvas)
   ===================================================================== */
let usuarioGeneradoTemp = '';

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

function renderEstadoLicencia(u) {
  if (u.vencida === undefined || u.vencida === null) return '—';
  const seg = Number(u.segundos_restantes) || 0;
  if (u.vencida) return '<span class="chip-vencida">○ Vencida</span>';
  if (u.es_demo) return '<span class="chip-demo">🧪 Demo · ' + esc(formatearVencimiento(seg)) + '</span>';
  if (seg < 7 * 24 * 3600) return '<span class="chip-por-vencer">⚠ Por vencer · ' + esc(formatearVencimiento(seg)) + '</span>';
  return '<span class="chip-ok">● Activa · ' + esc(formatearVencimiento(seg)) + '</span>';
}

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

    let consent = {};
    try {
      const rc = await sb.rpc('listar_consentimientos', { p_clave: adminClave });
      (rc.data || []).forEach(c => { consent[c.licencia_codigo] = c.consentimiento_fecha; });
    } catch (_) {}

    window.datosUsuariosAdmin = data;
    window.consentimientosAdmin = consent;
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

function exportarUsuariosExcel() {
  const datos = window.datosUsuariosAdmin;
  if (!Array.isArray(datos) || datos.length === 0) {
    if (typeof mostrarToast === 'function') mostrarToast('No hay docentes para exportar. Abre la pestaña de docentes primero.', 'error');
    else alert('No hay docentes para exportar.');
    return;
  }
  const consent = window.consentimientosAdmin || {};

  const celda = (v) => {
    let s = (v === undefined || v === null) ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };

  const estadoTexto = (u, esDemo) => {
    if (u.vencida === undefined || u.vencida === null) return '—';
    if (u.vencida) return 'Vencida';
    if (esDemo) return 'Demo';
    const seg = Number(u.segundos_restantes) || 0;
    return seg < 7 * 24 * 3600 ? 'Por vencer' : 'Activa';
  };

  const encabezados = ['Código', 'Cliente', 'Fase', 'Asignatura', 'Vence el', 'Estado', 'Intentos', 'Consentimiento'];
  const filas = datos.map(u => {
    const esDemo = (u.es_demo !== undefined && u.es_demo !== null) ? !!u.es_demo : String(u.codigo).startsWith(DEMO_PREFIJO);
    const venceEl = u.fecha_vencimiento ? formatearFechaHoraDDMMAAAA(u.fecha_vencimiento) : '—';
    const intentos = (u.intentos_count === undefined || u.intentos_count === null) ? '—' : u.intentos_count;
    const fechaC = u.consentimiento_fecha || consent[u.codigo];
    return [
      u.codigo,
      u.cliente,
      'Fase ' + (u.fase === undefined || u.fase === null ? '' : u.fase),
      u.asignatura,
      venceEl,
      estadoTexto(u, esDemo),
      intentos,
      fechaC ? formatearFechaDDMMAAAA(fechaC) : '—'
    ];
  });

  const csv = [encabezados].concat(filas).map(f => f.map(celda).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'docentes_apruebadocente.csv';
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function mostrarToast(mensaje, tipo = 'ok') {
  const t = document.createElement('div');
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.textContent = mensaje;
  t.style.cssText = 'position:fixed; right:20px; bottom:20px; z-index:10000; max-width:320px; padding:12px 16px; border-radius:12px; '
    + 'color:#fff; font:600 14px Inter, sans-serif; box-shadow:0 8px 24px rgba(0,0,0,.25); opacity:1; transition:opacity .5s ease; '
    + 'background:' + (tipo === 'error' ? 'var(--er)' : (tipo === 'info' ? '#64748b' : 'var(--okd)')) + ';';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; }, 2500);
  setTimeout(() => { t.remove(); }, 3000);
}

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
      await cargarUsuariosAdmin();
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

async function adminImprimirAvance(codigo) {
  try {
    const sb = obtenerSupabase();

    const { data, error } = await sb.rpc('admin_historial_por_licencia', { p_clave: adminClave, p_codigo: codigo });
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

    let fallosPorTema = [];
    let notaFallos = '';
    try {
      const intentoIds = filas.map(r => r.id ?? r.intento_id ?? r.intento ?? r.id_intento).filter(Boolean);
      let respuestasIncorrectas = [];

      if (intentoIds.length) {
        const ra = await sb.from('respuestas').select('*').in('intento_id', intentoIds);
        if (!ra.error && Array.isArray(ra.data)) {
          respuestasIncorrectas = ra.data.filter(x => x.es_correcta === false);
        }
      }
      if (!respuestasIncorrectas.length) {
        const rb = await sb.from('respuestas').select('*').eq('licencia_codigo', codigo);
        if (!rb.error && Array.isArray(rb.data)) {
          respuestasIncorrectas = rb.data.filter(x => x.es_correcta === false);
        }
      }
      if (!respuestasIncorrectas.length) {
        const rc = await sb.from('respuestas').select('*').limit(1000);
        if (!rc.error && Array.isArray(rc.data) && rc.data.length) {
          const colsCod = ['licencia_codigo','codigo_licencia','codigo','licencia','licencia_id'];
          const colCod = colsCod.find(c => Object.prototype.hasOwnProperty.call(rc.data[0], c));
          const colCorrecta = ['es_correcta','correcta','acierto','es_acierto']
            .find(c => Object.prototype.hasOwnProperty.call(rc.data[0], c)) || 'es_correcta';
          if (colCod) {
            respuestasIncorrectas = rc.data.filter(x =>
              String(x[colCod]) === String(codigo) && x[colCorrecta] === false
            );
          }
        }
      }

      const colPregunta = respuestasIncorrectas.length ? (
        'pregunta_id' in respuestasIncorrectas[0] ? 'pregunta_id' :
        'pregunta' in respuestasIncorrectas[0] ? 'pregunta' :
        'id_pregunta' in respuestasIncorrectas[0] ? 'id_pregunta' : null
      ) : null;

      const preguntaIds = [...new Set(respuestasIncorrectas.map(r => r[colPregunta]).filter(Boolean))];
      const mapaTemas = {};
      if (preguntaIds.length) {
        const rp = await sb.from('preguntas').select('*').in('id', preguntaIds);
        if (!rp.error && Array.isArray(rp.data)) {
          const colsTema = ['tema','materia','componente','area','subtema'];
          const colTema = colsTema.find(c => rp.data.length && Object.prototype.hasOwnProperty.call(rp.data[0], c)) || 'tema';
          rp.data.forEach(p => { mapaTemas[p.id] = p[colTema] || 'Sin tema'; });
        }
      }

      const conteo = {};
      respuestasIncorrectas.forEach(r => {
        const tema = mapaTemas[r[colPregunta]] || 'Sin tema';
        conteo[tema] = (conteo[tema] || 0) + 1;
      });
      fallosPorTema = Object.entries(conteo).map(([tema, fallos]) => ({ tema, fallos })).sort((a, b) => b.fallos - a.fallos);
      if (!fallosPorTema.length) notaFallos = 'Sin fallos registrados o datos no disponibles.';
    } catch (eFallos) {
      console.warn('No se pudo generar el análisis de fallos:', eFallos);
      notaFallos = 'No se pudo generar el análisis de fallos: ' + (eFallos.message || eFallos);
    }

    const totalIntentos = filas.length;
    const puntajes = filas.map(r => Number(r.puntaje) || 0);
    const promedio = Math.round(puntajes.reduce((a, b) => a + b, 0) / totalIntentos);
    const mejorPuntaje = Math.max(...puntajes);

    const ahora = new Date();
    const hhmm = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
    const emision = formatearFechaDDMMAAAA(ahora.toISOString());
    const etiquetaTipo = t => t === 'diagnostico' ? 'Diagnóstico' : (t === 'simulacro' ? 'Simulacro' : t);
    const celda = 'border:1px solid #999; padding:6px 8px; text-align:left; font-size:13px;';

    const filasOrdenadas = [...filas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const filasHistorial = filasOrdenadas.map(r => {
      const fechaTxt = r.fecha ? new Date(r.fecha).toLocaleDateString('es-EC') : '—';
      const tipoTxt = etiquetaTipo(r.tipo || '—');
      const puntajeTxt = (r.puntaje === undefined || r.puntaje === null) ? '—' : r.puntaje;
      const resultTxt = r.aprobado ? 'Aprobado' : 'Reprobado';
      const tiempoTxt = r.tiempo_usado_seg ? formatearTiempo(r.tiempo_usado_seg) : '—';
      return `
      <tr>
        <td style="${celda}">${esc(fechaTxt)}</td>
        <td style="${celda}">${esc(tipoTxt)}</td>
        <td style="${celda}"><strong>${esc(puntajeTxt)}</strong></td>
        <td style="${celda}">${resultTxt}</td>
        <td style="${celda}">${esc(tiempoTxt)}</td>
      </tr>`;
    }).join('');

    const filasFallos = fallosPorTema.length
      ? fallosPorTema.map(f => `
          <tr>
            <td style="${celda}">${esc(f.tema)}</td>
            <td style="${celda}"><strong>${esc(f.fallos)}</strong></td>
          </tr>`).join('')
      : `<tr><td colspan="2" style="${celda}; text-align:center; color:#64748b;">${esc(notaFallos || 'Sin fallos registrados o datos no disponibles.')}</td></tr>`;

    // =====================================================================
    // DIBUJAR GRÁFICOS USANDO <canvas> (A prueba de impresión)
    // =====================================================================
    function dibujarCanvas(id, puntos, color) {
      const canvas = document.getElementById(id);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const pad = { top: 20, right: 20, bottom: 40, left: 45 };
      const innerW = W - pad.left - pad.right;
      const innerH = H - pad.top - pad.bottom;
      const maxY = 1000;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.font = '10px Arial';

      if (!puntos.length) {
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('Sin evaluaciones de este tipo registradas.', W / 2, H / 2);
        return;
      }

      const n = puntos.length;
      const dx = n > 1 ? innerW / (n - 1) : 0;
      const xAt = i => pad.left + (n > 1 ? i * dx : innerW / 2);
      const yAt = v => pad.top + innerH - (Math.max(0, Math.min(maxY, v)) / maxY) * innerH;

      // Líneas guías
      [0, 250, 500, 700, 1000].forEach(v => {
        const y = yAt(v);
        ctx.beginPath();
        ctx.strokeStyle = v === 700 ? '#dc2626' : '#e2e8f0';
        ctx.lineWidth = v === 700 ? 1.5 : 1;
        if (v === 700) ctx.setLineDash([5, 4]);
        else ctx.setLineDash([]);
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + innerW, y);
        ctx.stroke();

        ctx.fillStyle = v === 700 ? '#dc2626' : '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText(v, pad.left - 6, y + 4);
      });
      ctx.setLineDash([]);

      // Texto aprobación
      ctx.fillStyle = '#dc2626';
      ctx.textAlign = 'right';
      ctx.font = 'bold 9px Arial';
      ctx.fillText('Aprobación 700', pad.left + innerW - 4, yAt(700) - 4);

      // Línea conectora
      if (n > 1) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        puntos.forEach((p, i) => {
          if (i === 0) ctx.moveTo(xAt(i), yAt(p.puntaje));
          else ctx.lineTo(xAt(i), yAt(p.puntaje));
        });
        ctx.stroke();
      }

      // Puntos
      puntos.forEach((p, i) => {
        const cx = xAt(i), cy = yAt(p.puntaje);
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = p.aprobado ? '#047857' : '#dc2626';
        ctx.stroke();

        // Etiqueta Puntaje
        ctx.fillStyle = p.aprobado ? '#047857' : '#dc2626';
        ctx.textAlign = 'center';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(p.puntaje, cx, cy - 10);

        // Etiqueta Fecha
        ctx.fillStyle = '#64748b';
        ctx.font = '9px Arial';
        ctx.fillText(p.fechaCorta, cx, H - pad.bottom + 14);
      });

      // Ejes
      ctx.beginPath();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.moveTo(pad.left, pad.top + innerH); ctx.lineTo(pad.left + innerW, pad.top + innerH);
      ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + innerH);
      ctx.stroke();
    }

    const normalizar = r => ({
      fecha: new Date(r.fecha),
      fechaCorta: r.fecha ? new Date(r.fecha).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit' }) : '',
      puntaje: Number(r.puntaje) || 0,
      aprobado: !!r.aprobado
    });

    const diagPuntos = filas.filter(r => r.tipo === 'diagnostico').map(normalizar).sort((a, b) => a.fecha - b.fecha);
    const simPuntos = filas.filter(r => r.tipo === 'simulacro').map(normalizar).sort((a, b) => a.fecha - b.fecha);

    // 9) Documento final
    $('area-impresion').innerHTML = `
      <div style="font-family:Arial, sans-serif; color:#000; background:#fff;">
        <h1 style="font-size:20px; margin:0 0 4px; text-align:center;">ApruebaDocente</h1>
        <h2 style="font-size:16px; margin:0 0 16px; text-align:center; font-weight:600;">Reporte de Avance Detallado</h2>

        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <tbody>
            <tr><td style="${celda}; width:30%;"><strong>Alumno:</strong></td><td style="${celda}">${esc(codigo)}</td></tr>
            <tr><td style="${celda};"><strong>Licencia:</strong></td><td style="${celda}">${esc(codigo)}</td></tr>
            <!-- CORRECCIÓN DE FASE:FASE -->
            <tr><td style="${celda};"><strong>Fase:</strong></td><td style="${celda}">${esc(filas[0].fase)}</td></tr>
            <tr><td style="${celda};"><strong>Asignatura:</strong></td><td style="${celda}">${esc(filas[0].asignatura)}</td></tr>
            <tr><td style="${celda};"><strong>Fecha de emisión:</strong></td><td style="${celda}">${esc(emision)} ${esc(hhmm)}</td></tr>
          </tbody>
        </table>

        <h3 style="font-size:15px; margin:0 0 8px;">Resumen</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <tbody>
            <tr><td style="${celda}; width:30%;"><strong>Total de intentos:</strong></td><td style="${celda}">${totalIntentos}</td></tr>
            <tr><td style="${celda};"><strong>Promedio:</strong></td><td style="${celda}">${promedio}</td></tr>
            <tr><td style="${celda};"><strong>Mejor puntaje:</strong></td><td style="${celda}">${mejorPuntaje}</td></tr>
          </tbody>
        </table>

        <h3 style="font-size:15px; margin:0 0 8px;">Evolución del puntaje</h3>
        
        <div style="border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-bottom:16px;">
          <div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:6px;">Evolución · Evaluaciones Diagnósticas</div>
          <canvas id="canvas-diag" width="640" height="220" style="display:block; max-width:100%;"></canvas>
        </div>
        
        <div style="border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-bottom:16px;">
          <div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:6px;">Evolución · Simulacros Oficiales</div>
          <canvas id="canvas-sim" width="640" height="220" style="display:block; max-width:100%;"></canvas>
        </div>

        <h3 style="font-size:15px; margin:0 0 8px;">Historial de evaluaciones</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="${celda}">Fecha</th>
              <th style="${celda}">Tipo</th>
              <th style="${celda}">Puntaje</th>
              <th style="${celda}">Resultado</th>
              <th style="${celda}">Tiempo</th>
            </tr>
          </thead>
          <tbody>${filasHistorial}</tbody>
        </table>

        <h3 style="font-size:15px; margin:0 0 8px;">Análisis de fallos por tema</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="${celda}">Tema</th>
              <th style="${celda}">Fallos</th>
            </tr>
          </thead>
          <tbody>${filasFallos}</tbody>
        </table>

        <p style="font-size:11px; color:#64748b; text-align:center; margin-top:24px;">
          Documento de seguimiento pedagógico · Generado el ${esc(emision)} ${esc(hhmm)}
        </p>
      </div>`;

    // Dibujar gráficos justo después de inyectar el HTML
    dibujarCanvas('canvas-diag', diagPuntos, '#2563eb');
    dibujarCanvas('canvas-sim', simPuntos, '#7c3aed');

    const limpiar = () => { $('area-impresion').innerHTML = ''; window.onafterprint = null; };
    window.onafterprint = limpiar;
    
    // Pequeño delay para asegurar que Canvas se dibuje antes de imprimir
    setTimeout(() => { window.print(); }, 100);

  } catch (e) {
    console.error(e);
    alert('Error al preparar el reporte de avance: ' + (e.message || e));
  }
}

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