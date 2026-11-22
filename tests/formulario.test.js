#!/usr/bin/env node
/**
 * Pruebas automatizadas para el formulario Copi Autopint (R5).
 * Detectan los problemas reportados en la auditoría:
 *  1. questions.json en public/ con ruta correcta para basePath.
 *  2. questions.json existe en el build out/.
 *  3. No hay número de WhatsApp ficticio.
 *  4. Persistencia de finalización con flag FINISHED_KEY.
 *  5. Workflow solo despliega desde main.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_JSON = path.join(ROOT, 'public', 'questions.json');
const PAGE_TS = path.join(ROOT, 'app', 'page.tsx');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'pages.yml');
const OUT_DIR = path.join(ROOT, 'out');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result === true) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      console.log(`  ✗ ${name}`);
    }
    return true;
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name} — ${e.message}`);
    return false;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---- Tests ----
console.log('\n— Pruebas: questions.json (public/) —');
test('public/questions.json existe', () => fs.existsSync(PUBLIC_JSON));
test('public/questions.json tiene 56 preguntas', () => {
  const data = JSON.parse(fs.readFileSync(PUBLIC_JSON, 'utf8'));
  return Array.isArray(data) && data.length === 56;
});
test('General tiene 1 pregunta', () => {
  const data = JSON.parse(fs.readFileSync(PUBLIC_JSON, 'utf8'));
  const general = data.filter(q => (q.section || '').toLowerCase() === 'general');
  return general.length === 1;
});
test('Inventario tiene 14 preguntas', () => {
  const data = JSON.parse(fs.readFileSync(PUBLIC_JSON, 'utf8'));
  const inv = data.filter(q => (q.section || '').toLowerCase() === 'inventario');
  return inv.length === 14;
});
test('Nomina tiene 13 preguntas', () => {
  const data = JSON.parse(fs.readFileSync(PUBLIC_JSON, 'utf8'));
  const nom = data.filter(q => (q.section || '').toLowerCase() === 'nomina');
  return nom.length === 13;
});
test('Finanzas tiene 14 preguntas', () => {
  const data = JSON.parse(fs.readFileSync(PUBLIC_JSON, 'utf8'));
  const fin = data.filter(q => (q.section || '').toLowerCase() === 'finanzas');
  return fin.length === 14;
});
test('Facturacion tiene 14 preguntas', () => {
  const data = JSON.parse(fs.readFileSync(PUBLIC_JSON, 'utf8'));
  const fac = data.filter(q => (q.section || '').toLowerCase() === 'facturacion');
  return fac.length === 14;
});

console.log('\n— Pruebas: carga en app/page.tsx —');
test('fetch usa ruta con basePath /copi-autopint-formulario', () => {
  const content = fs.readFileSync(PAGE_TS, 'utf8');
  return content.includes("fetch('/copi-autopint-formulario/questions.json'");
});
test('fetch NO usa ruta sin basePath /questions.json', () => {
  const content = fs.readFileSync(PAGE_TS, 'utf8');
  return !content.includes("fetch('/questions.json'");
});
test('no hay numero de WhatsApp ficticio 18095550000', () => {
  const content = fs.readFileSync(PAGE_TS, 'utf8');
  return !content.includes('18095550000');
});
test('usa FINISHED_KEY para persistencia de finalizacion', () => {
  const content = fs.readFileSync(PAGE_TS, 'utf8');
  return content.includes('FINISHED_KEY') && content.includes('copi-form-finished');
});

console.log('\n— Pruebas: workflow —');
test('workflow solo despliega desde main', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf8');
  const branchMatch = content.match(/branches:\s*\[([^\]]*)\]/);
  const branches = branchMatch ? branchMatch[1] : '';
  return branches.includes('main') && !branches.includes('feat/');
});

console.log('\n— Pruebas: build out/ —');
test('build out/ existe', () => fs.existsSync(OUT_DIR));
test('build out/questions.json existe', () => fs.existsSync(path.join(OUT_DIR, 'questions.json')));

// ---- Summary ----
console.log(`\nResultado: ${passed} pasadas, ${failed} fallidas`);
if (failed > 0) {
  process.exit(1);
}
process.exit(0);
