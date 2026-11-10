/* =====================================================================
   examen.js · MOTOR DE EXAMEN: iniciarExamen, navegación, cronómetro,
   anti-copia, finalizar/guardar, resultados e historial del docente.
   Depende de app.js (sesionActual, cargarBanco, armarIntegral, esPermitida).
   ===================================================================== */
async function iniciarExamen(tipo) {
  if (!sesionActual) { mostrarPantalla('pantalla-login'); return; }
  if (examenActual) return;

  const esSim = tipo === 'simulacro';
  const btn = $(esSim ? 'btn-iniciar-sim' : 'btn-iniciar-diag');
  const aviso = $('panel-fase-alerta');
  aviso.classList.add('hidden');
  btn.disabled = true;

  try {
    // Candado del servidor: la sesión debe seguir vigente en este dispositivo
    const { data, error } = await obtenerSupabase().rpc('renovar_sesion', {
      p_codigo: sesionActual.codigo,
      p_token: sesionActual.token
    });
    if (error) throw error;
    if (!data || !data.exito) {
      alert((data && data.mensaje) || 'Tu sesión ya no es válida.');
      await cerrarSesion();
      return;
    }

    sesionActual = aplicarDatosServidor(sesionActual, data);   // fase/asignatura del servidor
    const fase = sesionActual.fase;
    const asig = sesionActual.asignatura;
    const banco = await cargarBanco(fase, asig);

    // Diagnóstico: 5 asignatura + 2 Pedagógicos + 3 Digitales | Simulacro: 10 + 5 + 5
    const preguntas = esSim ? armarIntegral(banco, fase, asig, 10, 5, 5) : armarIntegral(banco, fase, asig, 5, 2, 3);

    // Candado del motor: TODAS deben ser permitidas
    if (!preguntas.every(q => esPermitida(q, fase, asig))) {
      throw new Error('Examen bloqueado: contiene preguntas no permitidas.');
    }

    examenActual = {
      tipo: tipo,
      preguntas: preguntas,
      indice: 0,
      respuestas: {},
      feedback: {},
      incidencias: 0,
      tiempoRestante: esSim ? 165 * 60 : 0,
      timer: null
    };

    mostrarPantalla('pantalla-examen');
    renderExamenUI();

    if (esSim) {
      $('timer').textContent = '⏱ ' + formatearTiempo(examenActual.tiempoRestante);
      iniciarCronometroExamen();
    } else {
      $('timer').classList.add('hidden');
    }
  } catch (e) {
    console.error(e);
    aviso.textContent = e.message || 'No se pudo iniciar el examen.';
    aviso.classList.remove('hidden');
  } finally {
    if (sesionActual && sesionActual.fase === 1) btn.disabled = false;
  }
}

/* ---------- 10. PANTALLA EXAMEN, ANTI-COPIA & RESULTADOS (B4) ---------- */
function renderExamenUI() {
  if (!examenActual) return;

  const q = examenActual.preguntas[examenActual.indice];
  const total = examenActual.preguntas.length;

  $('titulo-examen').textContent = examenActual.tipo === 'diagnostico' ? 'Evaluación Diagnóstica' : 'Simulacro Oficial';
  $('progreso-texto').textContent = `Pregunta ${examenActual.indice + 1} de ${total}`;
  $('pregunta-meta').textContent = `${esc(q.id)} · ${esc(q.materia)} · ${esc(q.tema)}`;
  $('pregunta-actual').innerHTML = fmt(q.pregunta);

  const contOp = $('opciones-container');
  contOp.innerHTML = '';
  const seleccionada = examenActual.respuestas[q.id];
  const respondidaDiag = examenActual.tipo === 'diagnostico' && examenActual.feedback[q.id];

  LETRAS.forEach(l => {
    const div = document.createElement('div');
    div.className = 'o';
    if (seleccionada === l) div.classList.add('s');

    if (respondidaDiag) {
      if (l === q.correcta) div.classList.add('s');
      else if (seleccionada === l) div.classList.add('x');
    }

    div.innerHTML = `<strong>${l}.</strong> ${esc(q.opciones[l])}`;
    div.onclick = () => seleccionarRespuestaExamen(q.id, l);
    contOp.appendChild(div);
  });

  const expBox = $('explicacion-box');
  if (respondidaDiag) {
    expBox.classList.remove('hidden');
    const esCorrecta = seleccionada === q.correcta;
    expBox.innerHTML = `
      <div class="demo-res ${esCorrecta ? 'ok' : 'no'}">
        <strong>${esCorrecta ? '✓ ¡Respuesta Correcta!' : '✗ Respuesta Incorrecta'}</strong>
        <p>${fmt(q.explicacion)}</p>
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

function seleccionarRespuestaExamen(preguntaId, letra) {
  if (!examenActual) return;
  if (examenActual.tipo === 'diagnostico' && examenActual.feedback[preguntaId]) return;

  examenActual.respuestas[preguntaId] = letra;

  if (examenActual.tipo === 'diagnostico') {
    examenActual.feedback[preguntaId] = true;
  }

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
  if (confirm('¿Estás seguro de que deseas cancelar el examen actual? Tu progreso no se guardará.')) {
    if (examenActual && examenActual.timer) clearInterval(examenActual.timer);
    examenActual = null;
    mostrarPantalla('pantalla-panel');
  }
}

async function finalizarExamen(auto = false) {
  if (!examenActual) return;
  if (examenActual.timer) clearInterval(examenActual.timer);

  const total = examenActual.preguntas.length;
  let aciertos = 0;
  const detalleRespuestas = [];

  examenActual.preguntas.forEach(q => {
    const resp = examenActual.respuestas[q.id] || null;
    const esCorrecta = resp === q.correcta;
    if (esCorrecta) aciertos++;

    detalleRespuestas.push({
      pregunta_id: q.id,
      respuesta: resp,
      correcta: q.correcta,
      es_correcta: esCorrecta,
      materia: q.materia,
      tema: q.tema,
      subtema: q.subtema
    });
  });

  const puntaje = Math.round((aciertos / total) * 1000);
  const aprobado = puntaje >= 701;

  try {
    const { data: intentoData, error: errIntento } = await obtenerSupabase().from('intentos').insert({
      licencia_codigo: sesionActual.codigo,
      tipo: examenActual.tipo,
      fase: sesionActual.fase,
      asignatura: sesionActual.asignatura,
      puntaje: puntaje,
      aprobado: aprobado,
      tiempo_usado_seg: examenActual.tipo === 'simulacro' ? (165 * 60 - examenActual.tiempoRestante) : 0
    }).select('id').single();

    if (!errIntento && intentoData) {
      const respInsert = detalleRespuestas.map(d => ({
        intento_id: intentoData.id,
        pregunta_id: d.pregunta_id,
        respuesta: d.respuesta,
        es_correcta: d.es_correcta
      }));
      await obtenerSupabase().from('respuestas').insert(respInsert);
    }
  } catch (e) {
    console.warn('Error registrando resultados en Supabase:', e);
  }

  renderResultadosUI(puntaje, aprobado, aciertos, total, detalleRespuestas);
  examenActual = null;
  mostrarPantalla('pantalla-resultados');
}

function renderResultadosUI(puntaje, aprobado, aciertos, total, detalle) {
  const resBox = $('resultado-resumen');
  resBox.innerHTML = `
    <h2 style="font-size:3rem; color:${aprobado ? 'var(--ok)' : 'var(--er)'}">${puntaje} / 1000</h2>
    <h3>${aprobado ? '¡Felicitaciones! Has Aprobado' : 'Resultado Insuficiente'}</h3>
    <p style="color:var(--mu);">${aciertos} aciertos de ${total} preguntas (${Math.round((aciertos/total)*100)}%)</p>`;

  const detBox = $('resultado-detalle');
  detBox.innerHTML = detalle.map((d, i) => `
    <div style="border-bottom:1px solid var(--ln); padding:12px 0;">
      <p><strong>${i + 1}. Reactivo ${esc(d.pregunta_id)} (${esc(d.materia)})</strong></p>
      <p style="font-size:13px; color:${d.es_correcta ? 'var(--okd)' : 'var(--er)'}">
        Tu respuesta: ${d.respuesta || 'Sin responder'} | Correcta: ${d.correcta}
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

function iniciarAntiCopiaEvents() {
  document.addEventListener('contextmenu', e => {
    if (examenActual) { e.preventDefault(); registrarIncidenciaCopia('Clic derecho desactivado.'); }
  });

  document.addEventListener('copy', e => {
    if (examenActual) { e.preventDefault(); registrarIncidenciaCopia('Copiar desactivado.'); }
  });

  document.addEventListener('keydown', e => {
    if (examenActual && (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'u' || e.key === 's')) {
      e.preventDefault();
      registrarIncidenciaCopia('Atajo bloqueado.');
    }
  });
}

function registrarIncidenciaCopia(motivo) {
  if (!examenActual) return;
  examenActual.incidencias++;
  if (examenActual.incidencias >= 5) {
    alert('⚠️ Se han detectado múltiples intentos de copia. Tu examen se anulará.');
    cancelarExamen();
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

    if (error || !data || !data.length) {
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
    tbody.innerHTML = '<tr><td colspan="6">Error al cargar historial.</td></tr>';
  }
}