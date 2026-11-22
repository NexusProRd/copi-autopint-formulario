import { test, expect } from '@playwright/test';
import fs from 'fs';

const BASE = '/copi-autopint-formulario';

test.describe('Copi Autopint — Formulario funcional (Playwright)', () => {
  test('TC-01: carga la pantalla inicial del cuestionario', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.getByRole('heading', { name: /Construyamos la solución/i })).toBeVisible();
    await expect(page.locator('#GEN01')).toBeVisible();
  });

  test('TC-02: navega a la siguiente etapa respondiendo GEN01', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('#GEN01')).toBeVisible();
    await page.locator('#GEN01 input[type="checkbox"]').first().check();
    await page.getByRole('button', { name: /Guardar y continuar/i }).click();
    await expect(page.locator('#INV01')).toBeVisible();
  });

  test('TC-03: persiste la respuesta del navegador al recargar', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.locator('#GEN01 input[type="checkbox"]').first().check();
    await page.reload();
    await expect(page.locator('#GEN01 input[type="checkbox"]').first()).toBeChecked();
  });

  test('TC-04: restaura el estado finalizado conservando las respuestas', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('copi-form-data-v3', JSON.stringify({ answers: { GEN01: ['Inventario'] }, otherTexts: {} }));
      localStorage.setItem('copi-form-finished', 'true');
    });
    await page.goto(BASE + '/');
    await expect(page.getByRole('heading', { name: /Cuestionario completado/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Descargar PDF/i })).toBeVisible();
  });

  test('TC-05: descarga un PDF desde la pantalla final', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('copi-form-finished', 'true');
    });
    await page.goto(BASE + '/');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.getByRole('button', { name: /Descargar PDF/i }).click(),
    ]);
    const target = '/tmp/opencode/copi-autopint-test.pdf';
    await download.saveAs(target);
    const size = fs.statSync(target).size;
    expect(size).toBeGreaterThan(0);
  });

  test('TC-06: muestra los dos botones finales y envía el PDF al equipo de NexusRD', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('copi-form-data-v3', JSON.stringify({ answers: { GEN01: ['Inventario'] }, otherTexts: {} }));
      localStorage.setItem('copi-form-finished', 'true');
    });
    await page.goto(BASE + '/');
    await expect(page.getByRole('heading', { name: /Cuestionario completado/i })).toBeVisible();

    const downloadPdf = page.getByRole('button', { name: /Descargar PDF/i });
    const enviarPdf = page.getByRole('button', { name: /Enviar PDF al equipo de NexusRD/i });
    await expect(downloadPdf).toBeVisible();
    await expect(enviarPdf).toBeVisible();
    await expect(page.getByRole('button', { name: /Descargar Excel/i })).toHaveCount(0);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      enviarPdf.click(),
    ]);
    const target = '/tmp/opencode/copi-autopint-test-enviar.pdf';
    await download.saveAs(target);
    const size = fs.statSync(target).size;
    expect(size).toBeGreaterThan(0);
  });
});
