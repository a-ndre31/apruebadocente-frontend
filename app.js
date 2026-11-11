/* =====================================================================
   app.js · NÚCLEO: constantes, estado, utilidades, Supabase, navegación,
   login/sesión, panel docente, banco de preguntas (por fase) y armado
   del examen (iniciarExamen / armarIntegral).

   Orden de carga en index.html:
   supabase-js (CDN) → config.js → app.js → examen.js → admin.js

   IMPORTANTE: iniciarExamen y armarIntegral viven SOLO aquí.
   examen.js NO debe volver a definirlas (si lo hace, pisa a esta versión).
   ===================================================================== */

/* Versión del código: se imprime en consola para comprobar que el navegador
   cargó este archivo y no una copia vieja en caché. Súbela cuando edites. */
const APP_VERSION = '2026.11.10-1';
console.info('[ApruebaDocente] app.js versión', APP_VERSION);

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

/* Composición oficial de cada examen (INEVAL).
   Diagnóstico: 25 + 12 + 13 = 50 | Simulacro: 60 + 21 + 18 = 99 */
// [NUEVO · TAREA 3] Versión de los textos legales aceptados. Súbela cada vez que cambie legales.js.
const CONSENT_VERSION = '2026-11-10';

// [NUEVO · TAREA 3] Prefijo de los códigos de demostración (1 hora de vigencia). Debe coincidir con es_codigo_demo() en SQL.
const DEMO_PREFIJO = 'prueba-';

const EXAMEN_CONFIG = {
  diagnostico: { esp: 25, ped: 12, dig: 13 },
  simulacro:   { esp: 60, ped: 21, dig: 18 }
};

// [NUEVO · TAREA 3] Los textos legales (LEGAL, LEGAL_RESP) viven en legales.js.
// Se eliminó aquí el "const LEGAL" duplicado: con ambos cargados el navegador
// lanza "Identifier 'LEGAL' has already been declared" y app.js no arranca.

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

// Examen activo (lo usa examen.js)
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

/* ---------- 4. SUPABASE ---------- */
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

/* ---------- 5. NAVEGACIÓN Y ARRANQUE ---------- */
function mostrarPantalla(id) {
  const destino = $(id);
  if (!destino) return;
  if (id !== 'pantalla-admin') adminClave = null;
  document.querySelectorAll('.pantalla').forEach(p => p.classList.toggle('activa', p === destino));
  window.scrollTo(0, 0);

  if (id === 'pantalla-login') actualizarEstadoBotonesLogin();   // [NUEVO · TAREA 3]
  if (id === 'pantalla-panel') actualizarPanelDocenteUI();
  if (id === 'pantalla-historial') cargarHistorialDocente();   // definida en examen.js
}

function init() {
  iniciarSupabase();

  // [NUEVO · TAREA 3] Consentimiento: estado inicial del botón y listeners de los checkboxes
  actualizarEstadoBotonesLogin();
  ['consent-terminos', 'consent-privacidad'].forEach(id => {
    const cb = $(id);
    if (cb) cb.addEventListener('change', actualizarEstadoBotonesLogin);
  });
  // [NUEVO · TAREA 4] Banner de cookies informativas
  mostrarBannerCookiesSiCorresponde();

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
  if (inputLic) inputLic.addEventListener('input', evaluarInputLoginEVDO);

  iniciarAntiCopiaEvents();   // definida en examen.js
  verificarSesionLocal();
}

document.addEventListener('DOMContentLoaded', init);

/* ---------- 6. BANCO DE PREGUNTAS (./data/*.json) ---------- */
/* Los nombres de archivo deben coincidir EXACTAMENTE con los de la carpeta data/. */
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

/* Compara asignaturas sin tildes, mayúsculas, signos (º, °) ni el rango entre paréntesis. */
function claveAsignatura(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/* Categoría de una pregunta: 'DIG' | 'PED' | 'ESP'.
   1) Se identifica por el prefijo del ID (DIG- / PED-).
   2) Si el ID no trae prefijo, se usa la materia del archivo en BANCO_JSON.
   3) Todo lo demás es de la asignatura (ESP). */
function categoriaDePregunta(id, def) {
  const pref = String(id || '').toUpperCase();
  if (pref.startsWith('DIG-')) return 'DIG';
  if (pref.startsWith('PED-')) return 'PED';
  if (def && def.materia === 'Digitales') return 'DIG';
  if (def && def.materia === 'Pedagógicos') return 'PED';
  return 'ESP';
}

const cacheBanco = {}; // archivo → preguntas ya convertidas

/* {id, materia, pregunta, opciones:[{letra,texto}], clave, argumento}
   → formato interno {opciones:{A,B,C,D}, correcta, explicacion, categoria, ...} */
function convertirPregunta(q, def, indice) {
  const opciones = {};
  (Array.isArray(q.opciones) ? q.opciones : []).forEach(op => { opciones[op.letra] = op.texto; });
  const id = q.id || `${def.archivo}-${indice + 1}`;
  return {
    id: id,
    fase: def.fase,
    categoria: categoriaDePregunta(id, def),
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

function esPreguntaValida(q) {
  if (!q || !q.pregunta || !q.opciones || typeof q.opciones !== 'object') return false;
  if (LETRAS.indexOf(q.correcta) === -1) return false;
  return LETRAS.every(l => typeof q.opciones[l] === 'string' && q.opciones[l].length > 0);
}

async function cargarArchivoBanco(def) {
  if (cacheBanco[def.archivo]) return cacheBanco[def.archivo];
  // ?v= + no-cache: evita que el navegador sirva un JSON viejo
  const url = './data/' + encodeURIComponent(def.archivo) + '.json?v=' + APP_VERSION;
  const resp = await fetch(url, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`${def.archivo}.json (HTTP ${resp.status})`);
  const datos = await resp.json();
  if (!Array.isArray(datos)) throw new Error(`${def.archivo}.json no es una lista de preguntas`);
  const convertidas = datos.map((q, i) => convertirPregunta(q, def, i));
  const invalidas = convertidas.filter(q => !esPreguntaValida(q)).length;
  if (invalidas) {
    console.warn(`${def.archivo}.json: ${invalidas} de ${convertidas.length} preguntas sin clave u opciones válidas (se descartan).`);
  }
  cacheBanco[def.archivo] = convertidas;
  return cacheBanco[def.archivo];
}

/* cargarBanco(fase)             → solo Digitales de esa fase (demo de la landing)
   cargarBanco(fase, asignatura) → Digitales + Pedagógicos + archivos de su asignatura */
async function cargarBanco(fase, asignatura = null) {
  const deLaFase = BANCO_JSON.filter(d => d.fase === Number(fase));
  if (!deLaFase.length) {
    throw new Error('Sin preguntas disponibles aún para esta fase.');
  }
  const claveDocente = claveAsignatura(asignatura);
  const defs = deLaFase.filter(d =>
    asignatura
      ? (d.asignatura === 'General' || claveAsignatura(d.asignatura) === claveDocente)
      : d.materia === 'Digitales'
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
    .map(s => `<h3>${esc(s[0])}</h3><p>${fmt(s[1])}</p>`).join('');
  const d = $('modal-legal');
  if (!d.open) d.showModal();
}

function cerrarLegal() { $('modal-legal').close(); }

/* ---------- 7B. CONSENTIMIENTO INFORMADO Y COOKIES ---------- */

// [NUEVO · TAREA 3] Formatea una fecha ISO como DD/MM/AAAA (también la usa admin.js).
function formatearFechaDDMMAAAA(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

// [NUEVO · TAREA 3] Formatea una fecha ISO como DD/MM/AAAA HH:mm (también la usa admin.js).
function formatearFechaHoraDDMMAAAA(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return formatearFechaDDMMAAAA(iso) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// [NUEVO · TAREA 3] Tiempo restante legible: "3 meses", "45 días", "2 días", "5 horas", "23 minutos" o "Vencida".
function formatearVencimiento(segundos) {
  const s = Number(segundos) || 0;
  if (s <= 0) return 'Vencida';
  const dias = Math.floor(s / 86400);
  if (dias >= 60) { const m = Math.round(dias / 30); return m + ' meses'; }
  if (dias >= 1) return dias + (dias === 1 ? ' día' : ' días');
  const horas = Math.floor(s / 3600);
  if (horas >= 1) return horas + (horas === 1 ? ' hora' : ' horas');
  const min = Math.max(1, Math.floor(s / 60));
  return min + (min === 1 ? ' minuto' : ' minutos');
}

// [NUEVO · TAREA 3] Devuelve el objeto guardado en localStorage 'evdo_consentimiento' o null.
function leerConsentimientoLocal() {
  try {
    const raw = localStorage.getItem('evdo_consentimiento');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

// [NUEVO · TAREA 3] Guarda el consentimiento local: {aceptado, fecha, version, terminos, privacidad, cookies}.
function guardarConsentimientoLocal(obj) {
  const registro = Object.assign({
    aceptado: true,
    fecha: new Date().toISOString(),
    version: CONSENT_VERSION,
    terminos: true,
    privacidad: true,
    cookies: true
  }, obj || {});
  try {
    localStorage.setItem('evdo_consentimiento', JSON.stringify(registro));
  } catch (e) {
    console.warn('No se pudo guardar el consentimiento local:', e);
  }
}

// [NUEVO · TAREA 3] true si hay consentimiento local aceptado de la versión vigente.
function consentimientoVigente() {
  const c = leerConsentimientoLocal();
  return !!(c && c.aceptado === true && c.version === CONSENT_VERSION);
}

// [NUEVO · TAREA 3] Sincroniza checkboxes, nota "Aceptado el..." y botón de ingreso.
function actualizarEstadoBotonesLogin() {
  const btn = $('btn-entrar');
  const cbT = $('consent-terminos');
  const cbP = $('consent-privacidad');
  const nota = $('consent-aceptado-nota');
  if (!btn || !cbT || !cbP) return;

  const vigente = consentimientoVigente();
  if (vigente) {
    const c = leerConsentimientoLocal();
    cbT.checked = true;
    cbP.checked = true;
    cbT.disabled = true;
    cbP.disabled = true;
    if (nota) {
      nota.textContent = '✓ Aceptado el ' + formatearFechaDDMMAAAA(c.fecha) + ' · versión ' + c.version;
      nota.classList.remove('hidden');
    }
  } else {
    cbT.disabled = false;
    cbP.disabled = false;
    if (nota) nota.classList.add('hidden');
  }
  btn.disabled = !(vigente || (cbT.checked && cbP.checked));
}

// [NUEVO · TAREA 3] Prueba server-side del consentimiento. Si falla, NO bloquea el login.
async function registrarConsentimientoServidor(codigo, userAgent) {
  try {
    const { data, error } = await obtenerSupabase().rpc('registrar_consentimiento', {
      p_codigo: codigo,
      p_terminos: true,
      p_privacidad: true,
      p_cookies: true,
      p_version: CONSENT_VERSION,
      p_user_agent: userAgent || navigator.userAgent
    });
    if (error) throw error;
    if (data && data.exito === false) console.warn('Consentimiento no registrado en el servidor:', data.mensaje);
  } catch (e) {
    console.warn('No se pudo registrar el consentimiento en el servidor:', e);
  }
}

// [NUEVO · TAREA 4] Reserva espacio al botón de WhatsApp según la altura real del banner.
function ajustarAlturaBannerCookies() {
  const b = $('cookie-banner');
  if (!b || b.hidden) return;
  document.documentElement.style.setProperty('--banner-h', b.offsetHeight + 'px');
}

// [NUEVO · TAREA 4] Muestra el banner de cookies informativas solo si aún no se aceptó.
function mostrarBannerCookiesSiCorresponde() {
  const b = $('cookie-banner');
  if (!b) return;
  let aceptadas = false;
  try { aceptadas = localStorage.getItem('evdo_cookies_aceptadas') === 'true'; } catch (_) {}
  if (aceptadas) { b.hidden = true; return; }

  b.hidden = false;
  window.addEventListener('resize', ajustarAlturaBannerCookies);
  requestAnimationFrame(() => {
    ajustarAlturaBannerCookies();
    document.body.classList.add('banner-visible');
    b.classList.add('visible');
  });
}

// [NUEVO · TAREA 4] Botón "Aceptar" del banner: guarda la preferencia y lo oculta con transición.
function aceptarCookies() {
  try { localStorage.setItem('evdo_cookies_aceptadas', 'true'); } catch (_) {}
  const b = $('cookie-banner');
  if (!b) return;
  b.classList.remove('visible');
  document.body.classList.remove('banner-visible');
  window.removeEventListener('resize', ajustarAlturaBannerCookies);
  setTimeout(() => { b.hidden = true; }, 300);
}

/* ---------- 8. AUTENTICACIÓN Y SESIÓN ---------- */
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

  // [NUEVO · TAREA 3] Consentimiento previo y obligatorio
  if (!consentimientoVigente()) {
    const aceptaT = $('consent-terminos') && $('consent-terminos').checked;
    const aceptaP = $('consent-privacidad') && $('consent-privacidad').checked;
    if (!aceptaT || !aceptaP) {
      errDiv.textContent = 'Debes aceptar los Términos y la Política de privacidad para continuar.';
      errDiv.classList.remove('hidden');
      return;
    }
    guardarConsentimientoLocal();
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

    // [NUEVO · TAREA 3] Constancia server-side del consentimiento (no rompe el flujo si falla)
    try {
      await registrarConsentimientoServidor(data.codigo);
    } catch (_) {}

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
      // [NUEVO · TAREA 3] Si la sesión cayó por vencimiento de la licencia, avisar en el login
      if (data && /venci/i.test(data.mensaje || '')) {
        const errLogin = $('login-error');
        if (errLogin) {
          errLogin.textContent = data.mensaje;
          errLogin.classList.remove('hidden');
        }
        mostrarPantalla('pantalla-login');
      }
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

/* ---------- 9. PANEL DOCENTE Y ARMADO DEL EXAMEN ---------- */
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

  actualizarBannerVencimiento();   // [NUEVO · TAREA 3]
}

// [NUEVO · TAREA 3] Banner de vigencia en el panel docente (la validación real es del servidor).
let timerVencimiento = null;

async function refrescarBannerVencimiento() {
  const box = $('panel-vencimiento');
  if (!box || !sesionActual) return;
  try {
    const { data, error } = await obtenerSupabase().rpc('consultar_vencimiento', { p_codigo: sesionActual.codigo });
    if (error || !data) return;

    const seg = Number(data.segundos_restantes) || 0;
    let texto = '';
    let clase = '';

    if (data.vencida) {
      texto = 'Tu licencia venció. Contacta al administrador para renovarla.';
      clase = 'banner-peligro';
      ['btn-iniciar-diag', 'btn-iniciar-sim'].forEach(id => { const b = $(id); if (b) b.disabled = true; });
    } else if (data.es_demo && seg <= 600) {
      texto = 'Acceso de prueba vence en ' + formatearVencimiento(seg) + '. Crea una licencia real para continuar.';
      clase = 'banner-aviso';
    } else if (seg <= 7 * 24 * 3600) {
      texto = 'Tu licencia vence en ' + formatearVencimiento(seg) + '. Contacta al administrador.';
      clase = 'banner-aviso';
    }

    if (!texto) {
      box.className = 'hidden';
      box.textContent = '';
      return;
    }
    box.className = clase;
    box.textContent = texto;
  } catch (_) {}
}

function actualizarBannerVencimiento() {
  refrescarBannerVencimiento();
  if (!timerVencimiento) {
    timerVencimiento = setInterval(() => {
      if (!sesionActual) { clearInterval(timerVencimiento); timerVencimiento = null; return; }
      refrescarBannerVencimiento();
    }, 60000);
  }
}

/* Candado: solo la fase del docente + su asignatura + preguntas generales (Digitales/Pedagógicos). */
function esPermitida(q, fase, asignatura) {
  if (!q || q.fase !== Number(fase)) return false;
  if (q.asignatura === 'General') return true;
  return claveAsignatura(q.asignatura) === claveAsignatura(asignatura);
}

/* Arma el examen integral. Sin "salvavidas": si falta una categoría, lanza error.
   La categoría (DIG / PED / ESP) se determina por el ID de la pregunta. */
function armarIntegral(banco, fase, asignatura, nEsp, nPed, nDig) {
  const pool = banco.filter(q => esPermitida(q, fase, asignatura) && esPreguntaValida(q));

  const digP = pool.filter(q => q.categoria === 'DIG');
  const pedP = pool.filter(q => q.categoria === 'PED');
  const espP = pool.filter(q => q.categoria === 'ESP');

  if (espP.length < nEsp || pedP.length < nPed || digP.length < nDig) {
    throw new Error(
      `Faltan preguntas válidas para armar el examen (disponibles/necesarias → ` +
      `asignatura: ${espP.length}/${nEsp}, Pedagógicos: ${pedP.length}/${nPed}, Digitales: ${digP.length}/${nDig}). ` +
      `Revisa que los JSON tengan el campo "clave" y que los IDs usen los prefijos DIG- y PED-.`
    );
  }

  return barajar([
    ...barajar(espP).slice(0, nEsp),
    ...barajar(pedP).slice(0, nPed),
    ...barajar(digP).slice(0, nDig)
  ]);
}

/* Llamada por los botones del panel: iniciarExamen('diagnostico' | 'simulacro') */
async function iniciarExamen(tipo) {
  if (!sesionActual) { mostrarPantalla('pantalla-login'); return; }
  if (examenActual) return;

  const esSim = tipo === 'simulacro';
  const cfg = esSim ? EXAMEN_CONFIG.simulacro : EXAMEN_CONFIG.diagnostico;
  const totalEsperado = cfg.esp + cfg.ped + cfg.dig;
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

    const preguntas = armarIntegral(banco, fase, asig, cfg.esp, cfg.ped, cfg.dig);

    if (preguntas.length !== totalEsperado) {
      throw new Error(`El examen debe tener ${totalEsperado} preguntas y se armaron ${preguntas.length}.`);
    }
    if (!preguntas.every(q => esPermitida(q, fase, asig))) {
      throw new Error('Examen bloqueado: contiene preguntas no permitidas.');
    }

    console.info(`[ApruebaDocente] ${tipo}: ${preguntas.length} preguntas ` +
      `(${cfg.esp} asignatura + ${cfg.ped} pedagógicos + ${cfg.dig} digitales)`);

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
    renderExamenUI();                 // definida en examen.js

    if (esSim) {
      $('timer').textContent = '⏱ ' + formatearTiempo(examenActual.tiempoRestante);
      iniciarCronometroExamen();      // definida en examen.js
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