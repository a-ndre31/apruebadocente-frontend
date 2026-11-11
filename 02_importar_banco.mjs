/* =====================================================================
   02_importar_banco.mjs · Importa data/*.json → tabla public.preguntas
   Uso:
     npm i @supabase/supabase-js
     SUPABASE_URL=https://xxxx.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=eyJ... \
     node 02_importar_banco.mjs ./data [--dry-run]
   La service_role key es SOLO para este script: nunca va en el frontend.
   ===================================================================== */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DIR = process.argv[2] || './data';
const DRY = process.argv.includes('--dry-run');
const DEMO_N = 20;       // cuántas preguntas Digitales quedan visibles en la landing
const LOTE = 200;

/* Mismo catálogo y orden que BANCO_JSON en app.js (el orden decide qué duplicado se conserva) */
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

const LETRAS = ['A', 'B', 'C', 'D'];

const norm = s => String(s == null ? '' : s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\([^)]*\)/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim();

function categoria(id, def) {
  const p = String(id || '').toUpperCase();
  if (p.startsWith('DIG-')) return 'DIG';
  if (p.startsWith('PED-')) return 'PED';
  if (def.materia === 'Digitales') return 'DIG';
  if (def.materia === 'Pedagógicos') return 'PED';
  return 'ESP';
}

function convertir(q, def, i) {
  const opciones = {};
  (Array.isArray(q.opciones) ? q.opciones : []).forEach(o => { opciones[o.letra] = o.texto; });
  const id = String(q.id || `${def.archivo}-${i + 1}`).trim();
  return {
    id,
    fase: def.fase,
    categoria: categoria(id, def),
    materia: def.materia,
    asignatura: def.asignatura,
    area: q.area || null,
    tema: q.tema || (def.asignatura === 'General' ? def.materia : def.asignatura),
    subtema: q.subtema || 'General',
    pregunta: q.pregunta,
    opciones,
    clave: q.clave,
    argumento: q.argumento || '',
    es_demo: false,
    activa: true
  };
}

const valida = r =>
  r.pregunta && LETRAS.includes(r.clave) &&
  LETRAS.every(l => typeof r.opciones[l] === 'string' && r.opciones[l].length > 0);

/* ---------- 1) Leer y convertir ---------- */
const filas = [];
const porId = new Map();
const textos = new Set();
const faltantes = [], invalidas = [], conflictos = [];
let duplicadas = 0;

for (const def of BANCO_JSON) {
  const ruta = path.join(DIR, def.archivo + '.json');
  let datos;
  try {
    datos = JSON.parse((await readFile(ruta, 'utf8')).replace(/^\uFEFF/, ''));
  } catch (e) {
    faltantes.push(`${def.archivo}.json (${e.code || e.message})`);
    continue;
  }
  if (!Array.isArray(datos)) { faltantes.push(`${def.archivo}.json no es una lista`); continue; }

  datos.forEach((q, i) => {
    const r = convertir(q, def, i);
    if (!valida(r)) { invalidas.push(`${def.archivo} → ${r.id}`); return; }

    const kTexto = norm(r.asignatura) + '|' + norm(r.pregunta);
    const previa = porId.get(r.id);
    if (previa) {
      // Mismo id: duplicado legítimo solo si es el mismo reactivo; si no, es un choque de ids
      if (previa.asignatura === r.asignatura && norm(previa.pregunta) === norm(r.pregunta)) duplicadas++;
      else conflictos.push(`${r.id}: "${previa.asignatura}" vs "${r.asignatura}" (${def.archivo})`);
      return;
    }
    if (textos.has(kTexto)) { duplicadas++; return; }   // mismo texto en la misma asignatura

    porId.set(r.id, r);
    textos.add(kTexto);
    filas.push(r);
  });
}

if (faltantes.length || conflictos.length) {
  if (faltantes.length) console.error('✗ Archivos no leídos:\n  - ' + faltantes.join('\n  - '));
  if (conflictos.length) console.error('✗ IDs repetidos con contenido distinto:\n  - ' + conflictos.join('\n  - '));
  console.error('\nCorrige y vuelve a ejecutar. No se escribió nada.');
  process.exit(1);
}

/* Marcar las primeras DEMO_N Digitales para la landing */
filas.filter(r => r.categoria === 'DIG').slice(0, DEMO_N).forEach(r => { r.es_demo = true; });

/* ---------- 2) Resumen ---------- */
const resumen = {};
filas.forEach(r => { const k = `${r.categoria} · ${r.asignatura}`; resumen[k] = (resumen[k] || 0) + 1; });
console.table(resumen);
console.log(`Preguntas a importar: ${filas.length} | duplicadas omitidas: ${duplicadas} | inválidas omitidas: ${invalidas.length} | demo: ${filas.filter(r => r.es_demo).length}`);
if (invalidas.length) console.warn('Inválidas:\n  - ' + invalidas.join('\n  - '));

if (DRY) { console.log('--dry-run: no se escribió nada.'); process.exit(0); }

/* ---------- 3) Subir (upsert por id) ---------- */
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

for (let i = 0; i < filas.length; i += LOTE) {
  const lote = filas.slice(i, i + LOTE);
  const { error } = await sb.from('preguntas').upsert(lote, { onConflict: 'id' });
  if (error) { console.error(`✗ Lote ${i}–${i + lote.length}:`, error.message); process.exit(1); }
  console.log(`✓ ${Math.min(i + LOTE, filas.length)} / ${filas.length}`);
}

/* ---------- 4) Verificar ---------- */
const { count, error } = await sb.from('preguntas').select('id', { count: 'exact', head: true });
if (error) { console.error('✗ Verificación:', error.message); process.exit(1); }
console.log(`✓ Importación completa. Filas en preguntas: ${count}`);
