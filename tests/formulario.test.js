const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const bank = require('../public/questions.json');
const duplicate = require('../questions.json');

test('56 identificadores únicos y distribución por módulo', () => {
  assert.deepEqual(bank, duplicate);
  assert.equal(bank.length, 56);
  assert.equal(new Set(bank.map(q => q.id)).size, 56);
  const counts = Object.fromEntries(['General','Inventario','Nomina','Finanzas','Facturacion'].map(section => [
    section, bank.filter(q => q.section === section).length
  ]));
  assert.deepEqual(Object.values(counts), [1, 14, 13, 14, 14]);
});

test('controles válidos, opciones distintas y un solo origen para Otro', () => {
  for (const q of bank) {
    assert.ok(q.question.startsWith('¿') && q.question.endsWith('?'), q.id);
    assert.ok(['checkbox', 'radio', 'parrafo', 'numero'].includes(q.type), q.id);
    assert.equal(new Set(q.options).size, q.options.length, q.id);
    assert.ok(!q.options.includes('Otro'), q.id);
  }
});

test('el build contiene la página, el banco y los activos bajo el prefijo de Pages', () => {
  const html = fs.readFileSync('out/index.html', 'utf8');
  assert.match(html, /\/copi-autopint-formulario\/_next\//);
  assert.deepEqual(require('../out/questions.json'), bank);
});

