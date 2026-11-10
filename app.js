/* =====================================================================
   app.js · NÚCLEO: constantes, estado, utilidades, Supabase, navegación,
   login/sesión, panel docente y carga de los JSON del banco (por fase).
   Carga: config.js → app.js → examen.js → admin.js
   ===================================================================== */
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

// Sesión docente
let sesionActual = null;
let timerRenovacion = null;

// Demo Landing
let demoActual = null;
let demoUltimoId = null;
let demoRespondida = false;

// Examen Activo
let examenActual = null; 


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

/* ---------- 6. BANCO DE PREGUNTAS (./data/*.json) ---------- */
/* Cada archivo JSON se asocia a su materia/asignatura. Los nombres deben coincidir
   EXACTAMENTE con los archivos de la carpeta data/. */
const BANCO_JSON = [
  { fase: 1, archivo: 'EVDO 2026 Digitales 350 Reactivos',   materia: 'Digitales',   asignatura: 'General' },
  { fase: 1, archivo: 'EVDO 2026 Pedagogicos 350 Reactivos', materia: 'Pedagógicos', asignatura: 'General' },
  { fase: 1, archivo: 'EVDO 2026 EGB 2a7 350 Reactivos',     materia: 'Específica',  asignatura: 'EGB Básica Media y Elemental (2.º a 7.º)' },
  { fase: 1, archivo: 'EVDO EGB 350 Revisado',               materia: 'Específica',  asignatura: 'EGB Básica Media y Elemental (2.º a 7.º)' },
  { fase: 1, archivo: 'EVDO 2026 Ciencias Sociales 350 Reactivos', materia: 'Específica', asignatura: 'EGB Superior (8.º a 10.º) Estudios Sociales' },
  { fase: 1, archivo: 'EVDO 2026 Ciencias Naturales 350 Reactivos', materia: 'Específica', asignatura: 'EGB Superior (8.º a 10.º) Ciencias Naturales' },
  { fase: 1, archivo: 'EVDO Emprendimiento 350 Revisado',    materia: 'Específica',  asignatura: 'BGU Emprendimiento y Gestión' },
  { fase: 1, archivo: 'EVDO 2026 Filosofia 350 Reactivos',   materia: 'Específica',  asignatura: 'BGU Filosofía' },
  { fase: 1, archivo: 'EVDO Quimica 350 Revisado',           materia: 'Específica',  asignatura: 'BGU Química' },
  { fase: 1, archivo: 'EVDO 2026 Biologia 350 Reactivos',    materia: 'Específica',  asignatura: 'BGU Biología' },
  { fase: 1, archivo: 'EVDO 2026 Ciudadania 350 Reactivos',  materia: 'Específica',  asignatura: 'BGU Educación para la Ciudadanía' }
];

/* MAPEADOR de asignaturas: compara sin tildes, sin mayúsculas, sin signos (º, °, espacios)
   y sin el rango entre paréntesis. "EGB Básica Media y Elemental (2.º a 7.º)" == "EGB Basica Media y Elemental". */
function claveAsignatura(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const cacheBanco = {}; // archivo → preguntas ya convertidas

/* Convierte {id, materia, pregunta, opciones:[{letra,texto}], clave, argumento}
   al formato interno {opciones:{A,B,C,D}, correcta, explicacion, ...} */
function convertirPregunta(q, def, indice) {
  const opciones = {};
  (Array.isArray(q.opciones) ? q.opciones : []).forEach(op => { opciones[op.letra] = op.texto; });
  return {
    id: q.id || `${def.archivo}-${indice + 1}`,
    fase: def.fase,
    materia: def.materia,
    asignatura: def.asignatura,
    tema: q.tema || (def.asignatura === 'General' ? def.materia : def.asignatura),
    subtema: q.subtema || 'General',
    pregunta: q.pregunta,
    opciones: opciones,
    correcta: q.clave,
    explicacion: q.argumento
  };
}

async function cargarArchivoBanco(def) {
  if (cacheBanco[def.archivo]) return cacheBanco[def.archivo];
  const url = './data/' + encodeURIComponent(def.archivo) + '.json';
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${def.archivo}.json (HTTP ${resp.status})`);
  const datos = await resp.json();
  if (!Array.isArray(datos)) throw new Error(`${def.archivo}.json no es una lista de preguntas`);
  const convertidas = datos.map((q, i) => convertirPregunta(q, def, i));
  const invalidas = convertidas.filter(q => !esPreguntaValida(q)).length;
  if (invalidas) {
    console.warn(`${def.archivo}.json: ${invalidas} de ${convertidas.length} preguntas sin clave de respuesta u opciones válidas (se descartan).`);
  }
  cacheBanco[def.archivo] = convertidas;
  return cacheBanco[def.archivo];
}

/* FILTRO POR FASE: solo se descargan los archivos de la fase del docente.
   - cargarBanco(fase)             → solo Digitales de esa fase (demo de la landing)
   - cargarBanco(fase, asignatura) → Digitales + Pedagógicos + archivos de su asignatura
   Si la fase no tiene archivos para esa asignatura (fases 2-4 hoy) → lanza
   "Sin preguntas disponibles aún" y NO descarga nada. */
async function cargarBanco(fase, asignatura = null) {
  const deLaFase = BANCO_JSON.filter(d => d.fase === Number(fase));
  if (!deLaFase.length) {
    throw new Error('Sin preguntas disponibles aún para esta fase.');
  }
  const claveDocente = claveAsignatura(asignatura);
  const defs = deLaFase.filter(d =>
    asignatura ? (d.asignatura === 'General' || claveAsignatura(d.asignatura) === claveDocente) : d.materia === 'Digitales'
  );
  if (asignatura && !defs.some(d => d.asignatura !== 'General')) {
    console.error('Asignatura de la licencia no reconocida:', JSON.stringify(asignatura));
    throw new Error(`La asignatura de tu licencia («${asignatura}») no coincide con ningún banco. Avisa al administrador.`);
  }
  const resultados = await Promise.allSettled(defs.map(cargarArchivoBanco));
  const fallos = resultados.filter(r => r.status === 'rejected').map(r => r.reason.message);
  if (fallos.length) {
    throw new Error('No se pudo cargar el banco de preguntas: ' + fallos.join('; ') +
      '. Revisa que la carpeta data/ esté junto a index.html y abre el sitio con un servidor local.');
  }
  // Sin repetidos: por id y por texto de la pregunta (los archivos "Revisado" repiten reactivos)
  const vistos = new Set();
  const banco = [];
  resultados.forEach(r => r.value.forEach(q => {
    const k = claveAsignatura(q.pregunta);
    if (vistos.has(q.id) || vistos.has(k)) return;
    vistos.add(q.id);
    vistos.add(k);
    banco.push(q);
  }));
  return banco;
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
    const banco = await cargarBanco(1);
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

/* Si el servidor devuelve fase/asignatura, mandan sobre lo guardado en localStorage. */
function aplicarDatosServidor(ses, resp) {
  const nueva = Object.assign({}, ses);
  if (resp && resp.fase != null) nueva.fase = Number(resp.fase);
  if (resp && resp.asignatura) nueva.asignatura = resp.asignatura;
  return nueva;
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

    sesionActual = aplicarDatosServidor(obj, data);
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

/* ---------- 9. PANEL DOCENTE & ARMADO DEL EXAMEN (filtro por fase/asignatura) ---------- */
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

/* Doble candado (motor): solo fase del docente + su asignatura + Digitales/Pedagógicos */
function esPermitida(q, fase, asignatura) {
  if (!q || q.fase !== Number(fase)) return false;
  if (q.asignatura === 'General') return q.materia === 'Digitales' || q.materia === 'Pedagógicos';
  return claveAsignatura(q.asignatura) === claveAsignatura(asignatura);
}

/* Arma el examen integral. Sin "salvavidas": si falta una categoría, lanza error. */
function armarIntegral(banco, fase, asignatura, nEsp, nPed, nDig) {
  const pool = banco.filter(q => esPermitida(q, fase, asignatura) && esPreguntaValida(q));
  const espP = pool.filter(q => q.asignatura !== 'General');
  const pedP = pool.filter(q => q.materia === 'Pedagógicos');
  const digP = pool.filter(q => q.materia === 'Digitales');
  if (espP.length < nEsp || pedP.length < nPed || digP.length < nDig) {
    throw new Error(`Faltan preguntas válidas para armar el examen (disponibles/necesarias → asignatura: ${espP.length}/${nEsp}, Pedagógicos: ${pedP.length}/${nPed}, Digitales: ${digP.length}/${nDig}). Revisa que los JSON tengan la clave de respuesta (campo "clave").`);
  }
  return barajar([
    ...barajar(espP).slice(0, nEsp),
    ...barajar(pedP).slice(0, nPed),
    ...barajar(digP).slice(0, nDig)
  ]);
}

/* Llamada por los botones del panel: iniciarExamen('diagnostico' | 'simulacro') */