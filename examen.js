/* =====================================================================
   examen.js · MOTOR DE EXAMEN: iniciarExamen, navegación, cronómetro,
   anti-copia, finalizar/guardar, resultados e historial del docente.
   Depende de app.js (sesionActual, cargarBanco, armarIntegral, esPermitida).
   ===================================================================== */

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
  // fb = respuesta del servidor {listo, correcta, es_correcta, explicacion} (solo diagnóstico)
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
    if (ex.feedback[preguntaId]) return;            // ya respondida o verificándose
    ex.feedback[preguntaId] = { listo: false };     // bloquea doble clic mientras responde el servidor
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
      console.error(e);
      delete ex.feedback[preguntaId];
      alert('No se pudo verificar la respuesta. Revisa tu conexión e intenta de nuevo.');
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
  
  const msg = '¿Seguro que deseas salir del examen?\n\nSe guardará tu calificación SOLO con las preguntas que has respondido hasta ahora. Las que dejaste en blanco contarán como incorrectas.';
  
  if (confirm(msg)) {
    // En lugar de borrar todo, forzamos a que termine y guarde el examen
    finalizarExamen(true); 
  }
}

async function finalizarExamen(auto = false) {
  if (!examenActual) return;
  const ex = examenActual;
  if (ex.enviando) return;                          // evita doble envío
  ex.enviando = true;
  if (ex.timer) clearInterval(ex.timer);

  const tiempoUsado = ex.tipo === 'simulacro'
    ? Math.max(0, 165 * 60 - ex.tiempoRestante)
    : 0;

  try {
    // El servidor califica (la clave nunca llega al navegador) y guarda intento + respuestas
    const { data, error } = await obtenerSupabase().rpc('calificar_examen', {
      p_codigo: sesionActual.codigo,
      p_token: sesionActual.token,
      p_tipo: ex.tipo,
      p_ids: ex.preguntas.map(q => q.id),
      p_respuestas: ex.respuestas,
      p_tiempo_usado_seg: tiempoUsado
    });
    if (error) throw error;

    examenActual = null;
    renderResultadosUI(data.puntaje, data.aprobado, data.aciertos, data.total, data.detalle);
    mostrarPantalla('pantalla-resultados');
  } catch (e) {
    console.error('❌ ERROR AL CALIFICAR/GUARDAR EL EXAMEN:', e);
    ex.enviando = false;
    alert('No se pudo calificar y guardar tu examen: ' + (e.message || e) +
      '\n\nTus respuestas siguen en pantalla. Ve a la última pregunta y pulsa «Finalizar» para reintentar.');
  }
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