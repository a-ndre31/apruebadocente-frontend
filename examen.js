/* =====================================================================
   examen.js · MOTOR DE EXAMEN + MODO VIGILADO REFORZADO
   - Simulacro: cámara + micrófono + fullscreen + anti-trampas + 5 min
   - Diagnóstico: fullscreen + anti-trampas + 5 min (sin cámara)
   ===================================================================== */

/* ---------- 10. PANTALLA EXAMEN, ANTI-COPIA & RESULTADOS ---------- */
function renderExamenUI() {
  if (!examenActual) return;

  const q = examenActual.preguntas[examenActual.indice];
  const total = examenActual.preguntas.length;

  $('titulo-examen').textContent = examenActual.tipo === 'diagnostico' ? 'Evaluación Diagnóstica' : 'Simulacro Oficial';
  $('progreso-texto').textContent = `Pregunta ${examenActual.indice + 1} de ${total}`;
  
  // [CAMBIO DE SEGURIDAD] Ocultamos el ID (q.id) para que no busquen la respuesta
  $('pregunta-meta').textContent = `${esc(q.materia)} · ${esc(q.tema)}`;
  
  $('pregunta-actual').innerHTML = fmt(q.pregunta);

  const contOp = $('opciones-container');
  contOp.innerHTML = '';
  const seleccionada = examenActual.respuestas[q.id];
  const fb = examenActual.tipo === 'diagnostico' ? examenActual.feedback[q.id] : null;
  const respondidaDiag = !!(fb && fb.listo);

  LETRAS.forEach(l => {
    const div = document.createElement('div');
    div.className = 'o';
    if (seleccionada === l) div.classList.add('s');

    if (respondidaDiag) {
      if (l === fb.correcta) div.classList.add('s');
      else if (seleccionada === l) div.classList.add('x');
    }

    div.innerHTML = `<strong>${l}.</strong> ${esc(q.opciones[l])}`;
    div.onclick = () => seleccionarRespuestaExamen(q.id, l);
    contOp.appendChild(div);
  });

  const expBox = $('explicacion-box');
  if (respondidaDiag) {
    expBox.classList.remove('hidden');
    expBox.innerHTML = `
      <div class="demo-res ${fb.es_correcta ? 'ok' : 'no'}">
        <strong>${fb.es_correcta ? '✓ ¡Respuesta Correcta!' : '✗ Respuesta Incorrecta'}</strong>
        <p>${fmt(fb.explicacion)}</p>
      </div>`;
  } else {
    expBox.classList.add('hidden');
  }

  renderNavegadorNumerico();

  $('btn-prev').disabled = examenActual.indice === 0;
  const esUltima = examenActual.indice === total - 1;
  $('btn-siguiente').classList.toggle('hidden', esUltima);
  $('btn-finalizar').classList.toggle('hidden', !esUltima);

  inyectarMarcaDeAgua();
}
function renderNavegadorNumerico() {
  const cont = $('navegador-preguntas');
  cont.innerHTML = '';
  examenActual.preguntas.forEach((p, idx) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.style.padding = '6px 12px';
    btn.style.fontSize = '12px';
    if (idx === examenActual.indice) btn.classList.replace('btn-secondary', 'btn-primary');

    if (examenActual.respuestas[p.id]) {
      btn.style.border = '2px solid var(--ok)';
    }

    btn.textContent = idx + 1;
    btn.onclick = () => {
      examenActual.indice = idx;
      renderExamenUI();
    };
    cont.appendChild(btn);
  });
}

async function seleccionarRespuestaExamen(preguntaId, letra) {
  if (!examenActual) return;
  const ex = examenActual;

  if (ex.tipo === 'diagnostico') {
    if (ex.feedback[preguntaId]) return;
    ex.feedback[preguntaId] = { listo: false };
    try {
      const { data, error } = await obtenerSupabase().rpc('verificar_respuesta', {
        p_id: preguntaId,
        p_letra: letra,
        p_codigo: sesionActual.codigo,
        p_token: sesionActual.token
      });
      if (error) throw error;
      ex.respuestas[preguntaId] = letra;
      ex.feedback[preguntaId] = {
        listo: true,
        correcta: data.correcta,
        es_correcta: data.es_correcta,
        explicacion: data.explicacion
      };
    } catch (e) {
      logDev(e);
      delete ex.feedback[preguntaId];
      alert(MSG_CONEXION);
    }
    if (examenActual === ex) renderExamenUI();
    return;
  }

  ex.respuestas[preguntaId] = letra;
  renderExamenUI();
}

function navegarPregunta(dir) {
  if (!examenActual) return;
  const n = examenActual.indice + dir;
  if (n >= 0 && n < examenActual.preguntas.length) {
    examenActual.indice = n;
    renderExamenUI();
  }
}

function iniciarCronometroExamen() {
  const timerEl = $('timer');
  timerEl.classList.remove('hidden');

  if (examenActual.timer) clearInterval(examenActual.timer);

  examenActual.timer = setInterval(() => {
    if (!examenActual) return;
    examenActual.tiempoRestante--;

    timerEl.textContent = `⏱ ${formatearTiempo(examenActual.tiempoRestante)}`;

    if (examenActual.tiempoRestante === 300) {
      alert('⚠️ Te quedan 5 minutos para finalizar tu simulacro.');
    }

    if (examenActual.tiempoRestante <= 0) {
      clearInterval(examenActual.timer);
      alert('⏱️ El tiempo ha finalizado. Tu examen se guardará automáticamente.');
      finalizarExamen(true);
    }
  }, 1000);
}

function cancelarExamen() {
  if (!examenActual) return;

  const esSim = examenActual.tipo === 'simulacro';
  const msg = esSim
    ? '¿Salir del simulacro?\n\nSi han pasado menos de 5 minutos, NO se calificará y deberás continuar hasta cumplir el mínimo.\n\nSi ya cumpliste 5 min, se guardará tu calificación SOLO con las respuestas actuales.'
    : '¿Seguro que deseas salir del diagnóstico?\n\nSi han pasado menos de 5 minutos, NO se calificará y deberás continuar hasta cumplir el mínimo.\n\nSi ya cumpliste 5 min, se guardará tu calificación SOLO con las respuestas actuales.';

  if (confirm(msg)) {
    finalizarExamen(true);
  }
}

async function finalizarExamen(auto = false) {
  if (!examenActual) return;
  const ex = examenActual;
  if (ex.enviando) return;

  // [LÍMITE 5 MIN REFORZADO] Validación en cliente con reloj monotónico
  if (!validarTiempoMinimoExamen(ex)) return;

  ex.enviando = true;
  if (ex.timer) clearInterval(ex.timer);

  // [FEEDBACK VISUAL] Botón "Calificando..." y deshabilitado mientras se procesa
  const btnFin = $('btn-finalizar');
  const TEXTO_BTN_FINALIZAR = 'Finalizar Examen';
  const restaurarBotonFinalizar = () => {
    if (!btnFin) return;
    btnFin.disabled = false;
    btnFin.textContent = TEXTO_BTN_FINALIZAR;
  };
  if (btnFin) {
    btnFin.disabled = true;
    btnFin.textContent = 'Calificando...';
  }

  // Cálculo del tiempo usado con reloj monotónico (no manipulable)
  const msTranscurridos = performance.now() - (ex.inicioMono || performance.now());
  const segTranscurridosMono = Math.floor(msTranscurridos / 1000);
  const tiempoUsado = ex.tipo === 'simulacro'
    ? Math.min(165 * 60, Math.max(0, Math.round(165 * 60 - ex.tiempoRestante)))
    : Math.min(segTranscurridosMono, 165 * 60);

  try {
    const { data, error } = await obtenerSupabase().rpc('calificar_examen', {
      p_codigo: sesionActual.codigo,
      p_token: sesionActual.token,
      p_tipo: ex.tipo,
      p_ids: ex.preguntas.map(q => q.id),
      p_respuestas: ex.respuestas,
      p_tiempo_usado_seg: tiempoUsado,
      p_minimo_seg_requerido: 300
    });
    if (error) throw error;

    if (data && data.exito === false) {
      ex.enviando = false;
      restaurarBotonFinalizar();
      alert(data.mensaje || MSG_CONEXION);
      return;
    }

    examenActual = null;
    restaurarBotonFinalizar();

    desactivarAntiTrampas();
    salirPantallaCompleta();
    apagarCamaraVigilancia();
    if (typeof resetCompromisoPanel === 'function') resetCompromisoPanel();

    renderResultadosUI(data.puntaje, data.aprobado, data.aciertos, data.total, data.detalle);
    mostrarPantalla('pantalla-resultados');
  } catch (e) {
    logDev('Error al calificar/guardar el examen:', e);
    ex.enviando = false;
    restaurarBotonFinalizar();
    alert(MSG_CONEXION +
      '\n\nTus respuestas siguen en pantalla. Ve a la última pregunta y pulsa «Finalizar» para reintentar.');
  }
}

/* ---------- Mensaje motivacional dinámico ---------- */
const MENSAJES_APROBADO = [
  '¡Felicitaciones! Superaste el puntaje de aprobación en esta práctica. ¡Sigue así!',
  '¡Excelente trabajo! Tu preparación está dando frutos. Mantén tu ritmo de estudio.',
  '¡Muy bien! Aprobaste este intento. Repasa lo que fallaste para llegar aún más seguro al examen.'
];
const MENSAJES_CERCA = [
  '¡Estás muy cerca! Repasa las explicaciones de las preguntas que fallaste y vuelve a intentarlo.',
  'Buen avance. Con un poco más de práctica en tus puntos débiles lo lograrás. ¡No te rindas!'
];
const MENSAJES_ANIMO = [
  'Todo gran resultado empieza con práctica. Usa el diagnóstico para aprender con explicaciones y vuelve a intentarlo.',
  'Este es solo el comienzo. Cada intento te enseña algo nuevo: revisa tus errores y sigue practicando. ¡Tú puedes!'
];

function mensajeMotivacional(aprobado, aciertos, total) {
  const pct = total > 0 ? aciertos / total : 0;
  const lista = aprobado ? MENSAJES_APROBADO : (pct >= 0.5 ? MENSAJES_CERCA : MENSAJES_ANIMO);
  return lista[Math.floor(Math.random() * lista.length)];
}

function renderResultadosUI(puntaje, aprobado, aciertos, total, detalle) {
  const resBox = $('resultado-resumen');
  const pct = total > 0 ? Math.round((aciertos / total) * 100) : 0;
  const estiloMsg = aprobado
    ? 'background:#ecfdf5; color:var(--okd); border:1px solid #a7f3d0;'
    : 'background:#fef3c7; color:#92400e; border:1px solid #fde68a;';

  resBox.innerHTML = `
    <h2 style="font-size:3rem; color:${aprobado ? 'var(--ok)' : 'var(--er)'}">${esc(puntaje)} / 1000</h2>
    <h3>${aprobado ? '¡Felicitaciones! Has Aprobado' : 'Resultado Insuficiente'}</h3>
    <p style="color:var(--mu);">${esc(aciertos)} aciertos de ${esc(total)} preguntas (${pct}%)</p>
    <p id="mensaje-motivacional" role="status" style="${estiloMsg} margin:16px auto 0; max-width:560px; padding:12px 16px; border-radius:10px; font-size:14px; font-weight:600;">
      ${esc(mensajeMotivacional(aprobado, aciertos, total))}
    </p>`;

  const detBox = $('resultado-detalle');
  detBox.innerHTML = (detalle || []).map((d, i) => `
    <div style="border-bottom:1px solid var(--ln); padding:12px 0;">
      <p><strong>${i + 1}. Reactivo ${esc(d.pregunta_id)} (${esc(d.materia)})</strong></p>
      <p style="font-size:13px; color:${d.es_correcta ? 'var(--okd)' : 'var(--er)'}">
        Tu respuesta: ${esc(d.respuesta || 'Sin responder')} | Correcta: ${esc(d.correcta)}
      </p>
    </div>`).join('');
}

function inyectarMarcaDeAgua() {
  let marca = $('marca-agua-dinamica');
  if (!marca) {
    marca = document.createElement('div');
    marca.id = 'marca-agua-dinamica';
    marca.style.position = 'fixed';
    marca.style.top = '50%';
    marca.style.left = '50%';
    marca.style.transform = 'translate(-50%, -50%) rotate(-30deg)';
    marca.style.fontSize = '24px';
    marca.style.color = 'rgba(0,0,0,0.04)';
    marca.style.pointerEvents = 'none';
    marca.style.zIndex = '9999';
    marca.style.textAlign = 'center';
    marca.style.userSelect = 'none';
    document.body.appendChild(marca);
  }

  if (sesionActual) {
    marca.innerHTML = `${esc(sesionActual.codigo)}<br>${new Date().toLocaleString('es-EC')}`;
  }
}

/* ---------- Anti-copia reforzado (aplica a diagnóstico Y simulacro) ---------- */
function iniciarAntiCopiaEvents() {
  document.addEventListener('contextmenu', e => {
    if (examenActual) { e.preventDefault(); registrarIncidenciaCopia('Clic derecho desactivado.'); }
  });

  document.addEventListener('copy', e => {
    if (examenActual) { e.preventDefault(); registrarIncidenciaCopia('Copiar desactivado.'); }
  });

  document.addEventListener('cut', e => {
    if (examenActual) { e.preventDefault(); registrarIncidenciaCopia('Cortar desactivado.'); }
  });

  document.addEventListener('paste', e => {
    if (examenActual) { e.preventDefault(); registrarIncidenciaCopia('Pegar desactivado.'); }
  });

  document.addEventListener('keydown', e => {
    if (!examenActual) return;

    // Detectar si es Mac (Cmd) o Windows/Linux (Ctrl)
    const esMac = e.metaKey;
    const esWin = e.ctrlKey;

    // 1. Bloquear atajos de teclado críticos (Ctrl/Cmd + C, U, S, P, A, F, R, I, J, N, T)
    if ((esMac || esWin) && ['c','u','s','p','a','f','r','i','j','n','t'].includes(String(e.key).toLowerCase())) {
      e.preventDefault();
      registrarIncidenciaCopia('Atajo bloqueado: ' + (esMac ? 'Cmd+' : 'Ctrl+') + e.key.toUpperCase());
      return;
    }

    // 2. Bloquear F12 y Escape
    if (e.key === 'F12' || e.key === 'Escape') {
      e.preventDefault();
      if (e.key === 'Escape' && examenActual.tipo === 'simulacro') {
        alert('⚠️ No puedes salir del modo de pantalla completa durante el simulacro.');
      }
      registrarIncidenciaCopia(e.key + ' bloqueado.');
      return;
    }

    // 3. Bloquear PrintScreen (Windows), Snapshot, y capturas de Mac (Cmd+Shift+3/4/5)
    if (
      e.key === 'PrintScreen' || 
      e.key === 'Snapshot' || 
      (esMac && e.shiftKey && ['3','4','5'].includes(e.key))
    ) {
      e.preventDefault();
      registrarIncidenciaCopia('Intento de captura de pantalla bloqueado.');
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(' ');
        }
      } catch (_) {}
      return;
    }
  });
}

function registrarIncidenciaCopia(motivo) {
  if (!examenActual) return;
  examenActual.incidencias = (examenActual.incidencias || 0) + 1;

  if (examenActual.incidencias >= 3) {
    alert('⚠️ Se han detectado múltiples intentos de copia/captura. Tu examen se anulará.');
    anularExamenPorTrampa('Múltiples intentos de copia/captura');
  }
}

async function cargarHistorialDocente() {
  const tbody = $('historial-lista');
  const vacio = $('historial-vacio');
  if (!tbody || !sesionActual) return;

  tbody.innerHTML = '<tr><td colspan="6">Cargando intentos...</td></tr>';

  try {
    const { data, error } = await obtenerSupabase()
      .from('intentos')
      .select('*')
      .eq('licencia_codigo', sesionActual.codigo)
      .order('fecha', { ascending: false });

    if (error) throw error;
    if (!data || !data.length) {
      tbody.innerHTML = '';
      if (vacio) vacio.classList.remove('hidden');
      return;
    }

    if (vacio) vacio.classList.add('hidden');
    tbody.innerHTML = data.map(i => `
      <tr>
        <td>${new Date(i.fecha).toLocaleDateString('es-EC')}</td>
        <td>${esc(i.tipo)}</td>
        <td>Fase ${i.fase}</td>
        <td>${esc(i.asignatura)}</td>
        <td><strong>${i.puntaje}</strong></td>
        <td><span style="color:${i.aprobado ? 'var(--ok)' : 'var(--er)'}; font-weight:700;">${i.aprobado ? 'Aprobado' : 'Reprobado'}</span></td>
      </tr>`).join('');
  } catch (e) {
    logDev('Error al cargar historial:', e);
    if (vacio) vacio.classList.add('hidden');
    tbody.innerHTML = `<tr><td colspan="6">${esc(MSG_CONEXION)}</td></tr>`;
  }
}

/* =====================================================================
   MODO VIGILADO REFORZADO
   ===================================================================== */

let _streamCamara = null;
let _videoCamara  = null;
let _anulandoPorSalida = false;

/* ---------- B.1 · Compromiso en el panel ---------- */
function actualizarBotonInicioExamen() {
  const chk = $('chk-compromiso');
  const bD  = $('btn-iniciar-diag');
  const bS  = $('btn-iniciar-sim');
  const ok  = !!(chk && chk.checked);
  if (bD && !bD.dataset.bloqueadoFase) bD.disabled = !ok;
  if (bS && !bS.dataset.bloqueadoFase) bS.disabled = !ok;
}

function resetCompromisoPanel() {
  const chk = $('chk-compromiso');
  if (chk) { chk.checked = false; chk.disabled = false; }
  actualizarBotonInicioExamen();
}

/* ---------- B.2 · Cámara + micrófono (solo simulacro) ---------- */
async function iniciarCamaraVigilancia() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      logDev('getUserMedia no disponible en este navegador.');
      return false;
    }
    _streamCamara = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
      audio: true
    });

    _videoCamara = document.createElement('video');
    _videoCamara.id = 'video-vigilancia';
    _videoCamara.autoplay = true;
    _videoCamara.muted = true;
    _videoCamara.playsInline = true;
    _videoCamara.srcObject = _streamCamara;
    _videoCamara.setAttribute('aria-label', 'Cámara de vigilancia del simulacro');
    _videoCamara.style.cssText =
      'position:fixed; right:16px; bottom:16px; width:160px; height:120px; ' +
      'border-radius:12px; border:3px solid #dc2626; background:#000; z-index:9998; ' +
      'object-fit:cover; box-shadow:0 8px 24px rgba(0,0,0,.35); transform:scaleX(-1);';

    const badge = document.createElement('div');
    badge.id = 'video-vigilancia-badge';
    badge.textContent = '● REC · SIMULACRO';
    badge.style.cssText =
      'position:fixed; right:16px; bottom:140px; width:160px; text-align:center; ' +
      'font:800 10px Inter, sans-serif; color:#fff; background:#dc2626; ' +
      'padding:4px 0; border-radius:6px; z-index:9999; letter-spacing:.06em;';

    document.body.appendChild(_videoCamara);
    document.body.appendChild(badge);
    return true;
  } catch (e) {
    logDev('No se pudo encender la cámara/micrófono:', e);
    alert('⚠️ No se pudo activar la cámara y el micrófono. El simulacro requiere ambos para el modo vigilado. Verifica los permisos de tu navegador.');
    return false;
  }
}

function apagarCamaraVigilancia() {
  try { if (_streamCamara) _streamCamara.getTracks().forEach(t => t.stop()); } catch (_) {}
  _streamCamara = null;
  if (_videoCamara) { _videoCamara.remove(); _videoCamara = null; }
  const b = $('video-vigilancia-badge'); if (b) b.remove();
}

/* ---------- B.3 · Pantalla completa (ambos modos) ---------- */
async function entrarPantallaCompleta() {
  try {
    const el = document.documentElement;
    
    // Si el navegador no soporta fullscreen (ej. Safari en iPhone), no bloqueamos el examen.
    // El anti-trampas de cambio de pestaña seguirá funcionando.
    if (!el.requestFullscreen && !el.webkitRequestFullscreen) {
      logDev('Fullscreen no soportado en este dispositivo.');
      return true; 
    }

    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
    
    return true;
  } catch (e) {
    logDev('No se pudo activar pantalla completa:', e);
    // Si el usuario lo negó en PC, bloqueamos el examen. Si es móvil, lo dejamos pasar.
    if (window.innerWidth > 768) return false;
    return true;
  }
}

function salirPantallaCompleta() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
  } catch (_) {}
}

/* ---------- B.4 · Anti-trampas (fullscreen + pestañas + blur + beforeunload) ---------- */
function _handlerSalidaFullscreen() {
  if (!examenActual) return;
  const salio = !document.fullscreenElement && !document.webkitFullscreenElement;
  if (salio && !examenActual.enviando && !_anulandoPorSalida) {
    _anulandoPorSalida = true;
    setTimeout(() => {
      if (!document.fullscreenElement && examenActual && !examenActual.enviando) {
        alert('❌ Has salido de pantalla completa. El examen será anulado con 0 puntos.');
        anularExamenPorTrampa('Salió de pantalla completa');
      }
      _anulandoPorSalida = false;
    }, 200);
  }
}

function _handlerVisibilidad() {
  if (document.hidden && examenActual && !examenActual.enviando) {
    alert('❌ Detectamos que cambiaste de pestaña o ventana. El examen será anulado con 0 puntos.');
    anularExamenPorTrampa('Cambió de pestaña/ventana');
  }
}

function _handlerBlur() {
  if (!examenActual || examenActual.enviando) return;
  if (document.hidden) return;
  setTimeout(() => {
    if (!examenActual || examenActual.enviando) return;
    if (!document.hasFocus() && !document.hidden) {
      alert('❌ Detectamos que cambiaste de ventana o aplicación. El examen será anulado con 0 puntos.');
      anularExamenPorTrampa('Cambió de ventana/aplicación');
    }
  }, 300);
}

function _handlerBeforeUnload(e) {
  if (examenActual && !examenActual.enviando) {
    e.preventDefault();
    e.returnValue = '';
    return 'Tienes un examen en curso. Si cierras la pestaña, perderás las respuestas no guardadas.';
  }
}

function activarAntiTrampas() {
  document.addEventListener('fullscreenchange', _handlerSalidaFullscreen);
  document.addEventListener('webkitfullscreenchange', _handlerSalidaFullscreen);
  document.addEventListener('visibilitychange', _handlerVisibilidad);
  window.addEventListener('blur', _handlerBlur);
  window.addEventListener('beforeunload', _handlerBeforeUnload);
}

function desactivarAntiTrampas() {
  document.removeEventListener('fullscreenchange', _handlerSalidaFullscreen);
  document.removeEventListener('webkitfullscreenchange', _handlerSalidaFullscreen);
  document.removeEventListener('visibilitychange', _handlerVisibilidad);
  window.removeEventListener('blur', _handlerBlur);
  window.removeEventListener('beforeunload', _handlerBeforeUnload);
  _anulandoPorSalida = false;
}

/* ---------- B.5 · Anulación con 0 puntos ---------- */
async function anularExamenPorTrampa(motivo) {
  const ex = examenActual;
  if (!ex || ex.enviando) return;
  ex.enviando = true;
  if (ex.timer) clearInterval(ex.timer);

  desactivarAntiTrampas();
  salirPantallaCompleta();
  apagarCamaraVigilancia();

  try {
    await obtenerSupabase().rpc('calificar_examen', {
      p_codigo: sesionActual.codigo,
      p_token: sesionActual.token,
      p_tipo: ex.tipo,
      p_ids: ex.preguntas.map(q => q.id),
      p_respuestas: {},
      p_tiempo_usado_seg: 0,
      p_minimo_seg_requerido: 0
    });
  } catch (e) {
    logDev('No se pudo registrar la anulación en Supabase:', e);
  }

  // Estas líneas son las que te faltaban en el mensaje:
  examenActual = null;
  if (typeof resetCompromisoPanel === 'function') resetCompromisoPanel();
  mostrarPantalla('pantalla-panel');
  alert('Tu intento fue anulado por: ' + motivo + '. Puntaje: 0.');
}

/* ---------- B.6 · LÍMITE 5 MIN REFORZADO ---------- */
function validarTiempoMinimoExamen(ex) {
  if (!ex) return true;

  const MINIMO_SEG = 300;

  const msTranscurridos = performance.now() - (ex.inicioMono || performance.now());
  const segMono = Math.floor(msTranscurridos / 1000);

  const segTimer = ex.tipo === 'simulacro'
    ? Math.max(0, 165 * 60 - ex.tiempoRestante)
    : segMono;

  const transcurrido = Math.min(segMono, segTimer);

  if (transcurrido < MINIMO_SEG) {
    const restante = MINIMO_SEG - transcurrido;
    alert(
      '⛔ No puedes finalizar el examen antes de 5 minutos.\n' +
      'Te faltan ' + formatearTiempo(restante) + ' para poder entregar.\n\n' +
      'Esta medida protege el banco de preguntas.'
    );
    return false;
  }
  return true;
}