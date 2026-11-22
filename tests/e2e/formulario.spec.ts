import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import bank from '../../public/questions.json';

const next = (page: Page) => page.getByRole('button', { name: /Guardar y continuar|Finalizar cuestionario/ });
const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
const longAnswer = 'Detalle de reparación con pintura y lijas. '.repeat(155) + 'FIN DE LA RESPUESTA';

async function extract(bytes: Buffer) {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const document = await task.promise;
  const pages = [];
  for (let i = 1; i <= document.numPages; ++i) {
    const page = await document.getPage(i);
    const { items } = await page.getTextContent();
    pages.push(clean(items.flatMap(item => 'str' in item ? [item.str] : []).join(' ')));
  }
  await task.destroy();
  return pages;
}

async function download(page: Page, name: string) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const file = await event;
  return extract(await readFile((await file.path())!));
}

async function start(page: Page, modules: string[]) {
  await page.goto('./');
  await expect(page.locator('#GEN01')).toBeVisible();
  for (const module of modules) await page.locator(`#GEN01 input[value="${module}"]`).check();
  await next(page).click();
}

for (const modules of [bank[0].options, ...bank[0].options.map(module => [module])]) {
  test(`recorrido real y PDF: ${modules.join(', ')}`, async ({ page }) => {
    const all = modules.length === 4;
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: () => false });
      window.open = url => { document.body.dataset.whatsapp = String(url); return null; };
    });
    await start(page, modules);
    const expected = new Map<string, string>([['GEN01', modules.join(', ')]]);
    const totalSteps = all ? 17 : 5;
    for (let step = 2; step <= totalSteps; step++) {
      await expect(page.getByText(`Paso ${step} de ${totalSteps}`, { exact: true })).toBeVisible();
      const ids = await page.locator('section.question').evaluateAll(els => els.map(el => el.id));
      if (all) {
        const first = bank.find(q => q.id === ids[0]);
        if (first?.required) {
          await next(page).click();
          await expect(page.getByText(/Completa la pregunta obligatoria/)).toBeVisible();
        }
      }
      for (const id of ids) {
        const field = page.locator('#' + id);
        const choice = field.locator('input[type=checkbox], input[type=radio]');
        if (await choice.count()) {
          const other = all && ['INV02', 'INV03', 'FAC02'].includes(id);
          const option = other ? field.locator('input[value="Otro"]') : choice.first();
          if (other) await expect(option).toHaveCount(1);
          await option.check();
          const value = (await option.getAttribute('value'))!;
          expected.set(id, value);
          if (other && id !== 'INV02') {
            await field.locator('textarea').fill('Detalle ' + id);
            expected.set(id, 'Otro: Detalle ' + id);
          }
        } else if (await field.locator('input[type=number]').count()) {
          const input = field.locator('input');
          if (all) {
            await input.fill('-7.5');
            await next(page).click();
            await expect(page.getByText(/Indica una cantidad entera/)).toBeVisible();
          }
          await input.fill('0');
          expected.set(id, '0');
        } else {
          const answer = all && id === 'INV14' ? longAnswer : 'Respuesta sintética ' + id;
          await field.locator('textarea').fill(answer);
          expected.set(id, answer);
        }
      }
      if (all && step === 2) {
        await next(page).click();
        await expect(page.getByText(/Describe la opción «Otro»/)).toBeVisible();
        await page.locator('#INV02 textarea').fill('Hoja auxiliar');
        expected.set('INV02', 'Otro: Hoja auxiliar');
        await page.reload();
        await expect(page.getByText('Paso 2 de 17', { exact: true })).toBeVisible();
        await expect(page.locator('#INV02 textarea')).toHaveValue('Hoja auxiliar');
      }
      if (all && step === 3) {
        await page.getByRole('button', { name: 'Anterior' }).click();
        await page.locator('#INV01 input[value="No"]').check();
        await expect(page.locator('#INV02')).toContainText('No aplica');
        expected.set('INV01', 'No');
        expected.set('INV02', 'No aplica');
        await next(page).click();
      }
      if (step === totalSteps) page.once('dialog', dialog => dialog.accept());
      await next(page).click();
    }
    await expect(page.getByRole('heading', { name: /Cuestionario completado/ })).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(2);
    const original = await download(page, 'Descargar PDF');
    const ids = original.join(' ').match(/\b(?:GEN|INV|NOM|FIN|FAC)\d\d · ¿/g)!.map(x => x.slice(0, 5));
    expect([...new Set(ids)]).toEqual([...expected.keys()]);
    expect(expected.size).toBe(all ? 56 : modules[0] === 'Nómina' ? 14 : 15);
    for (const [id, answer] of expected) {
      const segment = original.flatMap(text => text.split(/(?=\b(?:GEN|INV|NOM|FIN|FAC)\d\d · ¿)/))
        .filter(text => text.startsWith(id + ' · '));
      expect(segment.length, id).toBeGreaterThan(0);
      expect(segment[0]).toContain('Respuesta: ' + clean(answer.length > 300 ? answer.slice(0, 90) : answer));
      if (answer.length > 300) {
        expect(segment.at(-1)).toContain('FIN DE LA RESPUESTA');
        expect(segment.slice(1).every(part => part.includes('Respuesta (continuación):'))).toBe(true);
      }
    }
    await page.reload();
    expect(await download(page, 'Descargar PDF')).toEqual(original);
    const wa = page.getByRole('link', { name: 'Abrir WhatsApp del negocio' });
    await expect(wa).toHaveAttribute('target', '_blank');
    await expect(wa).toHaveAttribute('rel', /noopener/);
    await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/18295210521\?text=/);
    if (all) {
      const reset = page.getByRole('button', { name: /Borrar respuestas/ });
      await reset.click();
      await expect(page.getByRole('heading', { name: '¿Empezar de nuevo?' })).toBeVisible();
      await page.getByRole('button', { name: 'Conservar respuestas' }).click();
      await expect(page.getByRole('heading', { name: /Cuestionario completado/ })).toBeVisible();
      await reset.click();
      await page.getByRole('button', { name: 'Sí, borrar borrador' }).click();
      await page.reload();
      await expect(page.locator('#GEN01 input:checked')).toHaveCount(0);
    }
  });
}

test('La pantalla final permite borrar borrador mediante modal, sin confirmación nativa', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('copi-form-data-v4', JSON.stringify({
      stage: 4, finished: true,
      answers: { GEN01: ['Inventario'], INV01: 'No', INV03: ['Pinturas'], INV04: 'Menos de 20',
        INV05: ['Compra'], INV06: 'Sí', INV07: ['Galón'], INV08: 'Sí', INV10: 'Sí',
        INV11: ['Administrador'], INV12: 'Sí', INV13: ['Existencias actuales'], INV14: 'Control de materiales' }
    }));
  });
  await page.goto('./');
  const reset = page.getByRole('button', { name: 'Borrar respuestas y empezar de nuevo' });
  await expect(reset).toBeVisible();
  await reset.click();
  await expect(page.getByRole('alertdialog', { name: '¿Empezar de nuevo?' })).toBeVisible();
  await page.getByRole('button', { name: 'Conservar respuestas' }).click();
  await expect(page.getByRole('heading', { name: /Cuestionario completado/ })).toBeVisible();
  await reset.click();
  await page.getByRole('button', { name: 'Sí, borrar borrador' }).click();
  await expect(page.getByRole('heading', { name: 'Servicios solicitados' })).toBeVisible();
  await page.reload();
  await expect(page.locator('#GEN01 input:checked')).toHaveCount(0);
});

test('WhatsApp abre enlace directo sin invocar el menú compartir', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('copi-form-data-v4', JSON.stringify({
      stage: 4, finished: true,
      answers: { GEN01: ['Inventario'], INV01: 'No', INV03: ['Pinturas'], INV04: 'Menos de 20',
        INV05: ['Compra'], INV06: 'Sí', INV07: ['Galón'], INV08: 'Sí', INV10: 'Sí',
        INV11: ['Administrador'], INV12: 'Sí', INV13: ['Existencias actuales'], INV14: 'Control de materiales' }
    }));
    Object.defineProperty(navigator, 'share', { value: () => { document.body.dataset.shared = 'called'; } });
  });
  await page.goto('./');
  const link = page.getByRole('link', { name: 'Abrir WhatsApp del negocio' });
  await expect(link).toHaveAttribute('href', /^https:\/\/wa\.me\/18295210521\?text=/);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(page.locator('body')).not.toHaveAttribute('data-shared', 'called');
});

test('dependencias de costos y autorización y selección excluyente', async ({ page }) => {
  await start(page, ['Finanzas', 'Facturación']);
  const chooseFirst = async () => {
    for (const field of await page.locator('section.question').all()) {
      const option = field.locator('input[type=checkbox],input[type=radio]').first();
      const text = field.locator('textarea');
      if (await option.count()) await option.check();
      else if (await text.count()) await text.fill('Caso sintético');
    }
  };
  await chooseFirst();
  await next(page).click();
  await chooseFirst();
  await page.locator('#FIN07 input[value="No"]').check();
  await expect(page.locator('#FIN08')).toContainText('No aplica');
  await next(page).click();
  await chooseFirst();
  await next(page).click();
  await chooseFirst();
  await next(page).click();
  await chooseFirst();
  await page.locator('#FAC01 input[value="No inscrito"]').check();
  await expect(page.locator('#FAC03')).toContainText('No aplica');
  await next(page).click();
  await chooseFirst();
  await next(page).click();
  await page.locator('#FAC12 input[value="Anulaciones"]').check();
  await page.locator('#FAC12 input[value="Ninguno por ahora"]').check();
  await expect(page.locator('#FAC12 input[value="Anulaciones"]')).not.toBeChecked();
  await page.locator('#FAC12 input[value="Devoluciones"]').check();
  await expect(page.locator('#FAC12 input[value="Ninguno por ahora"]')).not.toBeChecked();
});

