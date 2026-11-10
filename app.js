/* =====================================================================
   ApruebaDocente · Código Completo (app.js)
   Integración funcional de B1, B2, B3, B4 y B5.
   ===================================================================== */

/* ---------- 1. CONSTANTES & CONFIGURACIÓN ---------- */
const ASIGNATURAS_POR_FASE = {
  1: [
    'EGB Básica Media y Elemental (2.º a 7.º)',
    'EGB Superior (8.º a 10.º) Estudios Sociales',
    'EGB Superior (8.º a 10.º) Ciencias Naturales',
    'BGU Emprendimiento y Gestión',
    'BGU Filosofía',
    'BGU Química',
    'BGU Biología',
    'BGU Educación para la Ciudadanía'
  ],
  2: [
    'Matemática (8.º EGB a 3.º BGU)',
    'Lengua y Literatura (8.º EGB a 3.º BGU)',
    'BGU Física',
    'BGU Historia',
    'Educación Inicial',
    'Educación Física'
  ],
  3: [
    'Bachillerato Técnico',
    'Educación Cultural y Artística (ECA)'
  ],
  4: [
    'Inglés',
    'Kichwa',
    'Shuar',
    'Francés'
  ]
};

const LETRAS = ['A', 'B', 'C', 'D'];

const LEGAL = {
  terminos: {
    titulo: 'Términos y condiciones',
    secciones: [
      ['1. Objeto del servicio', 'Descripción del servicio de práctica para la EVDO que ofrece ApruebaDocente.'],
      ['2. Licencia de uso', 'La licencia es personal e intransferible y habilita una fase y una asignatura.'],
      ['3. Sesión única', 'Cada licencia permite una sola sesión activa a la vez.'],
      ['4. Uso honesto del contenido', 'Prohibición de copiar, redistribuir o publicar el banco de preguntas.'],
      ['5. Vigencia', 'Duración de la licencia y condiciones de vencimiento (3 meses desde la creación).'],
      ['6. Independencia', 'ApruebaDocente no está afiliado ni representa al INEVAL o al Ministerio de Educación.'],
      ['7. Contacto', 'Canal de atención por WhatsApp.']
    ]
  },
  privacidad: {
    titulo: 'Política de privacidad',
    secciones: [
      ['1. Datos registrados', 'Identificador de la licencia, fase, asignatura y métricas de desempeño.'],
      ['2. Finalidad', 'Seguimiento pedagógico, control de sesión única por dispositivo y optimización de preguntas.'],
      ['3. Almacenamiento', 'Infraestructura cloud con políticas RLS activas.'],
      ['4. Derechos del usuario', 'Acceso, consulta y eliminación de registros de intentos.'],
      ['5. Contacto', 'Canal directo para consultas de privacidad.']
    ]
  }
};

/* ---------- 2. ESTADO GLOBAL ---------- */
let supabaseClient = null;
let supabaseListo = false;
let adminClave = null;
let bancoCargado = null; // Reemplaza a bancoPromesa

// Sesión docente
let sesionActual = null;
let timerRenovacion = null;

// Demo Landing
let demoActual = null;
let demoUltimoId = null;
let demoRespondida = false;

// Examen Activo
let examenActual = null; 

// Admin temporales
let usuarioGeneradoTemp = '';

/* ---------- 3. UTILIDADES GENERALES ---------- */
function $(id) { return document.getElementById(id); }

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC_MAP[c]);
}

function fmt(s) {
  return esc(s).replace(/\r?\n/g, '<br>');
}

function barajar(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatearTiempo(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ---------- 4. SUPABASE INICIALIZACIÓN ---------- */
function iniciarSupabase() {
  try {
    const urlOk = typeof SUPABASE_URL === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL);
    const keyOk = typeof SUPABASE_KEY === 'string' && SUPABASE_KEY.length > 20 && SUPABASE_KEY.indexOf('TU_') === -1;
    if (!urlOk || !keyOk) {
      console.warn('config.js: Variables de Supabase pendientes.');
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.warn('SDK de Supabase no cargado.');
      return;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    supabaseListo = true;
  } catch (e) {
    console.error('Error inicializando Supabase:', e);
    supabaseClient = null;
    supabaseListo = false;
  }
}

function obtenerSupabase() {
  if (!supabaseListo) throw new Error('Supabase no está configurado.');
  return supabaseClient;
}

/* ---------- 5. NAVEGACIÓN Y PANTALLAS ---------- */
function mostrarPantalla(id) {
  const destino = $(id);
  if (!destino) return;
  if (id !== 'pantalla-admin') adminClave = null;
  document.querySelectorAll('.pantalla').forEach(p => p.classList.toggle('activa', p === destino));
  window.scrollTo(0, 0);

  if (id === 'pantalla-panel') actualizarPanelDocenteUI();
  if (id === 'pantalla-historial') cargarHistorialDocente();
}

function init() {
  iniciarSupabase();

  ['modal-admin', 'modal-legal'].forEach(id => {
    const d = $(id);
    if (!d) return;
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
  });

  const mAdmin = $('modal-admin');
  if (mAdmin) {
    mAdmin.addEventListener('close', () => {
      if ($('admin-clave-input')) $('admin-clave-input').value = '';
      if ($('admin-clave-error')) $('admin-clave-error').classList.add('hidden');
    });
  }

  const inputLic = $('input-licencia');
  if (inputLic) {
    inputLic.addEventListener('input', evaluarInputLoginEVDO);
  }

  iniciarAntiCopiaEvents();
  verificarSesionLocal();
}

document.addEventListener('DOMContentLoaded', init);

/* ---------- 6. BANCO DE PREGUNTAS (CARGA DESDE JSON) ---------- */
const ARCHIVOS_JSON = [
  "EVDO 2026 Biologia 350 Reactivos",
  "EVDO 2026 Ciencias Naturales 350 Reactivos",
  "EVDO 2026 Ciencias Sociales 350 Reactivos",
  "EVDO 2026 Ciudadania 350 Reactivos",
  "EVDO 2026 Digitales 350 Reactivos",
  "EVDO 2026 EGB 2a7 350 Reactivos",
  "EVDO 2026 Filosofia 350 Reactivos",
  "EVDO 2026 Pedagogicos 350 Reactivos",
  "EVDO EGB 350 Revisado",
  "EVDO Emprendimiento 350 Revisado",
  "EVDO Quimica 350 Revisado"
];

async function cargarBanco() {
  if (bancoCargado) return bancoCargado;

  console.log("Cargando bancos de preguntas...");
  let todasLasPreguntas = [];

  for (const archivo of ARCHIVOS_JSON) {
    try {
      const url = `./data/${encodeURIComponent(archivo)}.json`;
      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error(`No se encontró ${archivo}`);
      
      const datos = await respuesta.json();
      todasLasPreguntas = [...todasLasPreguntas, ...datos];
    } catch (error) {
      console.warn(`Advertencia: ${error.message}`);
    }
  }

  // TRADUCCIÓN DE FORMATO:
  // Convertimos los datos de Python al formato que espera tu app
  bancoCargado = todasLasPreguntas.map((q, index) => {
    const opcionesObj = {};
    q.opciones.forEach(op => {
      opcionesObj[op.letra] = op.texto;
    });

    let faseAsignada = 1; 
    let tipoMateria = "Específica";
    
    if (q.materia.includes("Digitales")) tipoMateria = "Digitales";
    if (q.materia.includes("Pedagogicos")) tipoMateria = "Pedagógicos";

    return {
      id: q.id || `P-${index}`,
      fase: faseAsignada,
      materia: tipoMateria,
      asignatura: q.materia, // Nombre del archivo original
      tema: q.materia, 
      subtema: "General",
      pregunta: q.pregunta,
      opciones: opcionesObj,
      correcta: q.clave,
      explicacion: q.argumento
    };
  });

  console.log(`✅ Banco cargado: ${bancoCargado.length} preguntas listas.`);
  return bancoCargado;
}

function esPreguntaValida(q) {
  if (!q || !q.pregunta || !q.opciones || typeof q.opciones !== 'object') return false;
  if (LETRAS.indexOf(q.correcta) === -1) return false;
  return LETRAS.every(l => typeof q.opciones[l] === 'string' && q.opciones[l].length > 0);
}

/* ---------- 7. LANDING: DEMO ---------- */
async function cargarDemo() {
  const cont = $('demo-contenido');
  if (!cont) return;
  cont.innerHTML = '<p class="demo-estado">Cargando reactivo...</p>';
  try {
    const banco = await cargarBanco();
    const pool = banco.filter(q => q.fase === 1 && q.id !== demoUltimoId && esPreguntaValida(q));
    if (!pool.length) throw new Error('No hay preguntas disponibles para Fase 1.');
    demoActual = pool[Math.floor(Math.random() * pool.length)];
    demoUltimoId = demoActual.id;
    demoRespondida = false;
    renderDemo();
  } catch (e) {
    console.error(e);
    cont.innerHTML =
      '<p class="alerta-err" role="alert">No se pudo obtener el reactivo de prueba.</p>' +
      '<div class="demo-acciones"><button type="button" class="btn btn-primary" onclick="cargarDemo()">Reintentar</button></div>';
  }
}

function renderDemo() {
  const q = demoActual;
  const cont = $('demo-contenido');
  const opciones = LETRAS.map(l =>
    `<button type="button" class="o" data-letra="${l}"><strong>${l}.</strong> ${esc(q.opciones[l])}</button>`
  ).join('');
  cont.innerHTML =
    `<div class="demo-meta">${esc(q.materia)} · ${esc(q.tema)}</div>` +
    `<div class="q">${fmt(q.pregunta)}</div>` +
    `<div role="group" aria-label="Opciones">${opciones}</div>` +
    `<div id="demo-resultado" tabindex="-1" aria-live="polite"></div>`;
  cont.querySelectorAll('button.o').forEach(b =>
    b.addEventListener('click', () => responderDemo(b.dataset.letra))
  );
}

function responderDemo(letra) {
  const q = demoActual;
  if (!q || demoRespondida) return;
  demoRespondida = true;
  const acierto = letra === q.correcta;
  document.querySelectorAll('#demo-contenido button.o').forEach(b => {
    b.disabled = true;
    if (b.dataset.letra === q.correcta) b.classList.add('s');
    else if (b.dataset.letra === letra) b.classList.add('x');
  });
  const res = $('demo-resultado');
  res.innerHTML =
    `<div class="demo-res ${acierto ? 'ok' : 'no'}">` +
      `<strong>${acierto ? '✓ ¡Respuesta correcta!' : '✗ Respuesta incorrecta.'}</strong>` +
      (acierto ? '' : ` Opción correcta: ${esc(q.correcta)}.`) +
      `<p>${fmt(q.explicacion)}</p>` +
    `</div>` +
    `<div class="demo-acciones">` +
      `<button type="button" class="btn btn-outline" onclick="cargarDemo()">Otra pregunta</button>` +
      `<button type="button" class="btn btn-primary" onclick="mostrarPantalla('pantalla-login')">Ingresar al simulador</button>` +
    `</div>`;
  res.focus();
}

function abrirLegal(tipo) {
  const doc = LEGAL[tipo];
  if (!doc) return;
  $('legal-titulo').textContent = doc.titulo;
  $('legal-cuerpo').innerHTML = doc.secciones
    .map(s => `<h3>${esc(s[0])}</h3><p>${esc(s[1])}</p>`).join('');
  const d = $('modal-legal');
  if (!d.open) d.showModal();
}

function cerrarLegal() { $('modal-legal').close(); }

/* ---------- 8. AUTENTICACIÓN Y SESIÓN (B2) ---------- */
function validarEVDOFormat(codigo) {
  const regex = /^EVDO-([A-Z0-9]{6})-([A-Z0-9]{2})$/i;
  const match = codigo.trim().match(regex);
  if (!match) return false;

  const cuerpo = match[1].toUpperCase();
  const checksumEnviado = match[2].toUpperCase();

  let suma = 0;
  for (let i = 0; i < cuerpo.length; i++) {
    suma += cuerpo.charCodeAt(i);
  }
  const checksumCalculado = String((suma % 89) + 10).padStart(2, '0');
  return checksumEnviado === checksumCalculado;
}

function evaluarInputLoginEVDO() {
  const val = ($('input-licencia').value || '').trim();
  const bloqueEVDO = $('bloque-evdo-config');
  if (!bloqueEVDO) return;

  if (validarEVDOFormat(val)) {
    bloqueEVDO.classList.remove('hidden');
    actualizarAsignaturasEvdoLogin();
  } else {
    bloqueEVDO.classList.add('hidden');
  }
}

function actualizarAsignaturasEvdoLogin() {
  const fase = $('login-evdo-fase').value;
  const sel = $('login-evdo-asignatura');
  sel.innerHTML = '<option value="">— Selecciona tu asignatura —</option>';
  if (!fase || !ASIGNATURAS_POR_FASE[fase]) return;

  ASIGNATURAS_POR_FASE[fase].forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    sel.appendChild(opt);
  });
}

function obtenerOGenerarTokenDispositivo() {
  let token = localStorage.getItem('evdo_device_token');
  if (!token) {
    token = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('evdo_device_token', token);
  }
  return token;
}

async function iniciarSesion() {
  const inputLic = $('input-licencia');
  const codigo = (inputLic.value || '').trim();
  const errDiv = $('login-error');
  errDiv.classList.add('hidden');

  if (!codigo) {
    errDiv.textContent = 'Ingresa tu usuario o código de licencia.';
    errDiv.classList.remove('hidden');
    return;
  }

  const esEVDO = validarEVDOFormat(codigo);
  let faseEvdo = null;
  let asigEvdo = null;

  if (esEVDO) {
    faseEvdo = parseInt($('login-evdo-fase').value);
    asigEvdo = $('login-evdo-asignatura').value;
    if (!faseEvdo || !asigEvdo) {
      errDiv.textContent = 'Para licencias EVDO debes seleccionar la Fase y la Asignatura.';
      errDiv.classList.remove('hidden');
      return;
    }
  }

  const token = obtenerOGenerarTokenDispositivo();

  try {
    const { data, error } = await obtenerSupabase().rpc('iniciar_sesion', {
      p_codigo: codigo,
      p_token: token,
      p_fase: faseEvdo,
      p_asignatura: asigEvdo
    });

    if (error) throw error;
    if (!data.exito) {
      errDiv.textContent = data.mensaje || 'No se pudo iniciar sesión.';
      errDiv.classList.remove('hidden');
      return;
    }

    sesionActual = {
      codigo: data.codigo,
      token: token,
      fase: data.fase,
      asignatura: data.asignatura,
      cliente: data.cliente
    };

    localStorage.setItem('evdo_sesion_activa', JSON.stringify(sesionActual));
    iniciarRenovacionPeriodica();
    mostrarPantalla('pantalla-panel');

  } catch (e) {
    console.error(e);
    errDiv.textContent = 'Error de conexión con el servidor de autenticación.';
    errDiv.classList.remove('hidden');
  }
}

async function verificarSesionLocal() {
  const guardada = localStorage.getItem('evdo_sesion_activa');
  if (!guardada) return;

  try {
    const obj = JSON.parse(guardada);
    const { data, error } = await obtenerSupabase().rpc('renovar_sesion', {
      p_codigo: obj.codigo,
      p_token: obj.token
    });

    if (error || !data.exito) {
      cerrarSesionLocalSilencioso();
      return;
    }

    sesionActual = obj;
    iniciarRenovacionPeriodica();
    mostrarPantalla('pantalla-panel');
  } catch (e) {
    cerrarSesionLocalSilencioso();
  }
}

function iniciarRenovacionPeriodica() {
  if (timerRenovacion) clearInterval(timerRenovacion);
  timerRenovacion = setInterval(async () => {
    if (!sesionActual) return;
    try {
      const { data } = await obtenerSupabase().rpc('renovar_sesion', {
        p_codigo: sesionActual.codigo,
        p_token: sesionActual.token
      });
      if (data && !data.exito) {
        alert(data.mensaje || 'Tu sesión ha expirado o se abrió en otro dispositivo.');
        cerrarSesion();
      }
    } catch (_) {}
  }, 5 * 60 * 1000); 
}

async function cerrarSesion() {
  if (sesionActual && supabaseListo) {
    try {
      await obtenerSupabase().rpc('cerrar_sesion', {
        p_codigo: sesionActual.codigo,
        p_token: sesionActual.token
      });
    } catch (_) {}
  }
  cerrarSesionLocalSilencioso();
  mostrarPantalla('pantalla-inicio');
}

function cerrarSesionLocalSilencioso() {
  if (timerRenovacion) clearInterval(timerRenovacion);
  sesionActual = null;
  localStorage.removeItem('evdo_sesion_activa');
}

/* ---------- 9. PANEL DOCENTE & MOTOR INTEGRAL (B3) ---------- */
function actualizarPanelDocenteUI() {
  if (!sesionActual) return;

  $('user-licencia').textContent = sesionActual.codigo;

  const resumen = $('resumen-intentos');
  if (resumen) {
    resumen.innerHTML = `
      <div class="info-item"><div class="label">Docente</div><div class="valor">${esc(sesionActual.cliente || 'Docente')}</div></div>
      <div class="info-item"><div class="label">Licencia</div><div class="valor">${esc(sesionActual.codigo)}</div></div>
      <div class="info-item"><div class="label">Fase</div><div class="valor">Fase ${sesionActual.fase}</div></div>
      <div class="info-item"><div class="label">Asignatura</div><div class="valor">${esc(sesionActual.asignatura)}</div></div>`;
  }

  const btnDiag = $('btn-iniciar-diag');
  const btnSim = $('btn-iniciar-sim');
  const alertaFase = $('panel-fase-alerta');

  if (sesionActual.fase > 1) {
    if (btnDiag) btnDiag.disabled = true;
    if (btnSim) btnSim.disabled = true;
    if (alertaFase) {
      alertaFase.textContent = 'Sin preguntas disponibles aún para esta fase.';
      alertaFase.classList.remove('hidden');
    }
  } else {
    if (btnDiag) btnDiag.disabled = false;
    if (btnSim) btnSim.disabled = false;
    if (alertaFase) alertaFase.classList.add('hidden');
  }
}

function esPermitida(pregunta, faseDocente, asignaturaDocente) {
  if (!pregunta || pregunta.fase !== faseDocente) return false;
  if (pregunta.materia === 'Digitales' || pregunta.materia === 'Pedagógicos') return true;
  if (pregunta.materia === 'Específica' && pregunta.asignatura === asignaturaDocente) return true;
  return false;
}

async function armarIntegral(fase, asignatura, totalPreguntas) {
  const banco = await cargarBanco();
  
  // 1. Buscamos preguntas específicas usando palabras clave (para evitar problemas con nombres largos)
  let poolEspecífica = banco.filter(q => 
    q.fase === fase && 
    q.materia === 'Específica' && 
    q.asignatura.toLowerCase().includes(asignatura.toLowerCase().substring(0, 10)) && 
    esPreguntaValida(q)
  );

  // Si no encuentra por nombre exacto, que tome todas las específicas de esa fase
  if (poolEspecífica.length < (totalPreguntas * 0.5)) {
      poolEspecífica = banco.filter(q => q.fase === fase && q.materia === 'Específica' && esPreguntaValida(q));
  }

  const poolDigitales = banco.filter(q => q.fase === fase && q.materia === 'Digitales' && esPreguntaValida(q));
  const poolPedagogicos = banco.filter(q => q.fase === fase && q.materia === 'Pedagógicos' && esPreguntaValida(q));

  const cantEspecífica = Math.floor(totalPreguntas * 0.50);
  const cantDigitales = Math.floor(totalPreguntas * 0.25);
  const cantPedagogicos = totalPreguntas - cantEspecífica - cantDigitales;

  // Seleccionamos
  let seleccionEspecífica = barajar(poolEspecífica).slice(0, cantEspecífica);
  let seleccionDigitales = barajar(poolDigitales).slice(0, cantDigitales);
  let seleccionPedagogicos = barajar(poolPedagogicos).slice(0, cantPedagogicos);

  let seleccionFinal = [...seleccionEspecífica, ...seleccionDigitales, ...seleccionPedagogicos];

  // 2. SALVAVIDAS: Si falta alguna pregunta (porque no hay suficientes de una categoría), 
  // rellenamos con cualquier otra pregunta válida que tengamos en el banco.
  if (seleccionFinal.length < totalPreguntas) {
    const idsActuales = seleccionFinal.map(q => q.id);
    const restoDelBanco = banco.filter(q => q.fase === fase && !idsActuales.includes(q.id) && esPreguntaValida(q));
    
    // Agregamos las que falten
    const faltantes = totalPreguntas - seleccionFinal.length;
    seleccionFinal = [...seleccionFinal, ...barajar(restoDelBanco).slice(0, faltantes)];
  }

  if (seleccionFinal.length < totalPreguntas) {
    throw new Error('No hay suficientes preguntas en total en el banco. Revisa que los JSON se cargaron bien.');
  }

  return barajar(seleccionFinal);
}

async function armarIntegralEstructurado(fase, asignatura, cantEspecificas, cantPedagogicas, cantDigitales) {
  const banco = await cargarBanco();
  const totalRequerido = cantEspecificas + cantPedagogicas + cantDigitales;

  // 1. Filtrar Específicas
  let poolEspecificas = banco.filter(q => 
    q.fase === fase && 
    q.materia === 'Específica' && 
    q.asignatura.toLowerCase().includes(asignatura.toLowerCase().substring(0, 10)) && 
    esPreguntaValida(q)
  );
  
  // Salvavidas para específicas
  if (poolEspecificas.length < cantEspecificas) {
      const especificasExtra = banco.filter(q => q.fase === fase && q.materia === 'Específica' && esPreguntaValida(q));
      poolEspecificas = [...poolEspecificas, ...especificasExtra];
  }

  // 2. Filtrar Pedagógicas
  let poolPedagogicas = banco.filter(q => q.fase === fase && q.materia === 'Pedagógicos' && esPreguntaValida(q));

  // 3. Filtrar Digitales
  let poolDigitales = banco.filter(q => q.fase === fase && q.materia === 'Digitales' && esPreguntaValida(q));

  // 4. Seleccionar la cantidad exacta requerida
  let seleccionEspecificas = barajar(poolEspecificas).slice(0, cantEspecificas);
  let seleccionPedagogicas = barajar(poolPedagogicas).slice(0, cantPedagogicas);
  let seleccionDigitales = barajar(poolDigitales).slice(0, cantDigitales);

  let seleccionFinal = [...seleccionEspecificas, ...seleccionPedagogicas, ...seleccionDigitales];

  // 5. Salvavidas general
  if (seleccionFinal.length < totalRequerido) {
    const idsActuales = seleccionFinal.map(q => q.id);
    const restoDelBanco = banco.filter(q => q.fase === fase && !idsActuales.includes(q.id) && esPreguntaValida(q));
    const faltantes = totalRequerido - seleccionFinal.length;
    seleccionFinal = [...seleccionFinal, ...barajar(restoDelBanco).slice(0, faltantes)];
  }

  if (seleccionFinal.length < totalRequerido) {
    throw new Error(`Faltan preguntas. Se necesitan ${totalRequerido} y solo hay ${seleccionFinal.length} disponibles.`);
  }

  return barajar(seleccionFinal);
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