/* =====================================================================
   app.js · NÚCLEO: constantes, estado, utilidades, Supabase, navegación,
   login/sesión, panel docente, banco de preguntas (por fase) y armado
   del examen (iniciarExamen / armarIntegral).
   ===================================================================== */

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
const CONSENT_VERSION = '2026-11-10';
const DEMO_PREFIJO = 'prueba-';

const EXAMEN_CONFIG = {
  diagnostico: { esp: 25, ped: 12, dig: 13 },
  simulacro:   { esp: 60, ped: 21, dig: 18 }
};

/* ---------- 2. ESTADO GLOBAL ---------- */
let supabaseClient = null;
let supabaseListo = false;
let adminClave = null;
let sesionActual = null;
let timerRenovacion = null;
let demoActual = null;
let demoUltimoId = null;
let demoRespondida = false;
let examenActual = null;

/* ---------- 3. UTILIDADES GENERALES ---------- */
function $(id) { return document.getElementById(id); }
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC_MAP[c]); }
function fmt(s) { return esc(s).replace(/\r?\n/g, '<br>'); }

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
    if (!urlOk || !keyOk) { console.warn('config.js: Variables de Supabase pendientes.'); return; }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') { console.warn('SDK de Supabase no cargado.'); return; }
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

  if (id === 'pantalla-login') actualizarEstadoBotonesLogin();
  if (id === 'pantalla-panel') actualizarPanelDocenteUI();
  if (id === 'pantalla-historial') cargarHistorialDocente();
}

function init() {
  iniciarSupabase();
  actualizarEstadoBotonesLogin();
  ['consent-terminos', 'consent-privacidad'].forEach(id => {
    const cb = $(id);
    if (cb) cb.addEventListener('change', actualizarEstadoBotonesLogin);
  });
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

  iniciarAntiCopiaEvents();
  verificarSesionLocal();
}

document.addEventListener('DOMContentLoaded', init);

/* ---------- 6. BANCO DE PREGUNTAS (Supabase · RPC) ---------- */
function claveAsignatura(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const cacheBanco = {};

function convertirPregunta(q) {
  return {
    id: q.id,
    fase: Number(q.fase),
    categoria: q.categoria,
    materia: q.materia,
    asignatura: q.asignatura,
    tema: q.tema || 'General',
    subtema: q.subtema || 'General',
    pregunta: q.pregunta,
    opciones: q.opciones || {}
  };
}

function esPreguntaValida(q) {
  if (!q || !q.pregunta || !q.opciones || typeof q.opciones !== 'object') return false;
  return LETRAS.every(l => typeof q.opciones[l] === 'string' && q.opciones[l].length > 0);
}

async function cargarBanco(fase, asignatura = null) {
  const sb = obtenerSupabase();
  let clave, llamada;

  if (!asignatura) {
    clave = 'demo|' + Number(fase);
    llamada = () => sb.rpc('obtener_banco_demo', { p_fase: Number(fase) });
  } else {
    if (!sesionActual) throw new Error('Inicia sesión para cargar el banco de preguntas.');
    clave = [sesionActual.codigo, Number(fase), claveAsignatura(asignatura)].join('|');
    llamada = () => sb.rpc('obtener_banco', {
      p_codigo: sesionActual.codigo,
      p_token: sesionActual.token
    });
  }

  if (cacheBanco[clave]) return cacheBanco[clave];

  const { data, error } = await llamada();
  if (error) {
    console.error('Error cargando el banco:', error);
    throw new Error(error.message || 'No se pudo cargar el banco de preguntas.');
  }
  if (!Array.isArray(data) || !data.length) {
    throw new Error(asignatura
      ? `No hay preguntas disponibles para tu licencia («${asignatura}»). Avisa al administrador.`
      : 'Sin preguntas disponibles aún para esta fase.');
  }

  const banco = data.map(convertirPregunta).filter(esPreguntaValida);
  if (banco.length !== data.length) {
    console.warn(`Banco: ${data.length - banco.length} preguntas inválidas descartadas.`);
  }
  cacheBanco[clave] = banco;
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

async function responderDemo(letra) {
  const q = demoActual;
  if (!q || demoRespondida) return;
  demoRespondida = true;

  const botones = document.querySelectorAll('#demo-contenido button.o');
  botones.forEach(b => { b.disabled = true; });
  const res = $('demo-resultado');

  let v;
  try {
    const { data, error } = await obtenerSupabase().rpc('verificar_respuesta', {
      p_id: q.id,
      p_letra: letra
    });
    if (error) throw error;
    v = data;
  } catch (e) {
    console.error(e);
    demoRespondida = false;
    botones.forEach(b => { b.disabled = false; });
    res.innerHTML = '<p class="alerta-err" role="alert">No se pudo verificar la respuesta. Intenta de nuevo.</p>';
    return;
  }

  botones.forEach(b => {
    if (b.dataset.letra === v.correcta) b.classList.add('s');
    else if (b.dataset.letra === letra) b.classList.add('x');
  });
  res.innerHTML =
    `<div class="demo-res ${v.es_correcta ? 'ok' : 'no'}">` +
      `<strong>${v.es_correcta ? '✓ ¡Respuesta correcta!' : '✗ Respuesta incorrecta.'}</strong>` +
      (v.es_correcta ? '' : ` Opción correcta: ${esc(v.correcta)}.`) +
      `<p>${fmt(v.explicacion)}</p>` +
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
function formatearFechaDDMMAAAA(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function formatearFechaHoraDDMMAAAA(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return formatearFechaDDMMAAAA(iso) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

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

function leerConsentimientoLocal() {
  try {
    const raw = localStorage.getItem('evdo_consentimiento');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

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

function consentimientoVigente() {
  const c = leerConsentimientoLocal();
  return !!(c && c.aceptado === true && c.version === CONSENT_VERSION);
}

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

function ajustarAlturaBannerCookies() {
  const b = $('cookie-banner');
  if (!b || b.hidden) return;
  document.documentElement.style.setProperty('--banner-h', b.offsetHeight + 'px');
}

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
  Object.keys(cacheBanco).forEach(k => delete cacheBanco[k]);
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

  actualizarBannerVencimiento();
}

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

function esPermitida(q, fase, asignatura) {
  if (!q || q.fase !== Number(fase)) return false;
  if (q.asignatura === 'General') return true;
  return claveAsignatura(q.asignatura) === claveAsignatura(asignatura);
}

function armarIntegral(banco, fase, asignatura, nEsp, nPed, nDig) {
  const pool = banco.filter(q => esPermitida(q, fase, asignatura) && esPreguntaValida(q));

  const digP = pool.filter(q => q.categoria === 'DIG');
  const pedP = pool.filter(q => q.categoria === 'PED');
  const espP = pool.filter(q => q.categoria === 'ESP');

  if (espP.length < nEsp || pedP.length < nPed || digP.length < nDig) {
    throw new Error(
      `Faltan preguntas válidas para armar el examen (disponibles/necesarias → ` +
      `asignatura: ${espP.length}/${nEsp}, Pedagógicos: ${pedP.length}/${nPed}, Digitales: ${digP.length}/${nDig}).`
    );
  }

  return barajar([
    ...barajar(espP).slice(0, nEsp),
    ...barajar(pedP).slice(0, nPed),
    ...barajar(digP).slice(0, nDig)
  ]);
}

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

    sesionActual = aplicarDatosServidor(sesionActual, data);
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