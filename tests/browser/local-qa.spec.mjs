import { test, expect } from '@playwright/test';

test.describe('local qa metadata flow', () => {
  test('invoer -> citaat -> label zichtbaar', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/rio/local-qa.html');

    await page.fill('#title', 'Bureau document');
    await page.fill('#content', 'Dit is een testcitaat uit het document.');
    await page.fill('#origin', 'Bureau A');
    await page.selectOption('#status', 'historisch');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="quote-card"]')).toContainText('Bureau A · historisch');
    await expect(page.locator('[data-testid="quote-card"]')).toContainText('gebruikersopgave — niet geverifieerd');
  });

  test('ongeldige status wordt geweigerd', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/rio/local-qa.html');

    await page.fill('#title', 'Probleemdocument');
    await page.fill('#content', 'Test inhoud');
    await page.fill('#origin', 'Bron 1');
    await page.evaluate(() => {
      document.querySelector('#status').add(new Option('invalid', 'invalid-status'));
    });
    await page.selectOption('#status', 'invalid-status');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-error-box]')).toContainText('Ongeldige status');
    await expect(page.locator('[data-testid="quote-card"]')).toHaveCount(0);
  });
});

async function fillDocument(page, content = 'Eerste inhoud') {
  await page.fill('#title', 'Document');
  await page.fill('#content', content);
  await page.fill('#origin', 'Bron A');
}

test('validation preserves the old quote and successful retry clears the error', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.click('button[type="submit"]');
  for (const content of ['', '   ']) {
    await page.fill('#content', content);
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-error-box]')).toHaveText('Documentinhoud is vereist.');
    await expect(page.locator('blockquote')).toHaveText('Eerste inhoud');
  }
  await page.fill('#title', '   ');
  await page.fill('#content', 'Nieuwe inhoud');
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-error-box]')).toHaveText('Documenttitel is vereist.');
  await page.fill('#title', 'Nieuw document');
  await page.fill('#origin', 'Bron B');
  await page.selectOption('#status', 'specificatie');
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-error-box]')).toBeEmpty();
  await expect(page.locator('[data-testid="quote-card"]')).toHaveCount(1);
  await expect(page.locator('blockquote')).toHaveText('Nieuwe inhoud');
  await expect(page.locator('.quote-meta')).toHaveText('Bron B · specificatie');
});

for (const status of ['draft', 'historisch', 'specificatie']) {
  test(`blank origin and literal HTML content: ${status}`, async ({ page }) => {
    await page.goto('/rio/local-qa.html');
    const content = '<img src=x onerror="window.injected=true">';
    await fillDocument(page, content);
    await page.fill('#origin', '   ');
    await page.selectOption('#status', status);
    await page.click('button[type="submit"]');
    await expect(page.locator('.quote-meta')).toHaveText(`ONBEKEND · ${status}`);
    await expect(page.locator('.quote-disclaimer')).toHaveText('gebruikersopgave — niet geverifieerd');
    await expect(page.locator('blockquote')).toHaveText(content);
    await expect(page.locator('blockquote img')).toHaveCount(0);
  });
}

test('reset clears fields, quote and error, then permits a fresh save', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.selectOption('#status', 'historisch');
  await page.click('button[type="submit"]');
  await page.fill('#content', '');
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-error-box]')).not.toBeEmpty();
  await page.click('#reset-document');
  for (const field of ['title', 'content', 'origin']) {
    await expect(page.locator(`#${field}`)).toHaveValue('');
  }
  await expect(page.locator('#status')).toHaveValue('draft');
  await expect(page.locator('[data-error-box]')).toBeEmpty();
  await expect(page.locator('[data-testid="quote-card"]')).toHaveCount(0);
  await expect(page.locator('.empty-state')).toBeVisible();
  await fillDocument(page, 'Na reset');
  await page.fill('#origin', 'Nieuwe bron');
  await page.click('button[type="submit"]');
  await expect(page.locator('blockquote')).toHaveText('Na reset');
  await expect(page.locator('.quote-meta')).toHaveText('Nieuwe bron · draft');
});


test('multiple documents survive reload, support edits and persistent deletion', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page, 'Inhoud A');
  await page.fill('#title', 'Document A');
  await page.selectOption('#status', 'historisch');
  await page.click('button[type="submit"]');
  await page.click('#reset-document');
  await fillDocument(page, 'Inhoud B');
  await page.fill('#title', 'Document B');
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-document-list] button')).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: 'Document A', exact: true }).click();
  await expect(page.locator('#status')).toHaveValue('historisch');
  await expect(page.locator('blockquote')).toHaveText('Inhoud A');
  await expect(page.locator('.quote-disclaimer')).toHaveText('gebruikersopgave — niet geverifieerd');
  await page.fill('#content', 'A gewijzigd');
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-document-list] button')).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: 'Document A', exact: true }).click();
  await expect(page.locator('blockquote')).toHaveText('A gewijzigd');
  await page.click('#delete-document');
  await expect(page.locator('[data-testid="quote-card"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-document-list] button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Document B', exact: true }).click();
  await expect(page.locator('blockquote')).toHaveText('Inhoud B');
});

test('corrupt storage is preserved and blocks saving', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await page.evaluate(() => localStorage.setItem('local-qa.documents.v1', '{broken'));
  await page.reload();
  await expect(page.locator('[data-storage-error]')).toContainText('beschadigd');
  await fillDocument(page);
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-error-box]')).toContainText('beschadigd');
  await expect(page.locator('[data-document-list] button')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('local-qa.documents.v1'))).toBe('{broken');
});

test('quota failure preserves the previous quote and editable input', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.click('button[type="submit"]');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; });
  await page.fill('#content', 'Niet opgeslagen');
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-error-box]')).toContainText('Niet opgeslagen');
  await expect(page.locator('blockquote')).toHaveText('Eerste inhoud');
  await expect(page.locator('#content')).toHaveValue('Niet opgeslagen');
  await expect(page.locator('[data-save-status]')).toBeEmpty();
});

test('another tab cannot silently overwrite newer documents', async ({ page, context }) => {
  await page.goto('/rio/local-qa.html');
  const other = await context.newPage();
  await other.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.click('button[type="submit"]');
  await fillDocument(other, 'Ander tabblad');
  await other.click('button[type="submit"]');
  await expect(other.locator('[data-error-box]')).toContainText('ander tabblad');
  await other.reload();
  await expect(other.locator('[data-document-list] button')).toHaveCount(1);
});

async function uploadBackup(page, data) {
  await page.locator('#import-documents').setInputFiles({
    name: 'backup.json', mimeType: 'application/json',
    buffer: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)),
  });
}

const backupDoc = (id, title = 'Import', status = 'draft') => ({
  documentId: id, title, content: 'Tekst uit archief',
  source: { origin: 'Archief', status, verified: true, statusProvidedBy: 'SYSTEM' },
});

test('search and status filter combine without changing selected quote', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await uploadBackup(page, { version: 1, documents: [backupDoc('a', 'Plan', 'historisch'), backupDoc('b', 'Rapport')] });
  await expect(page.locator('[data-backup-status]')).toHaveText('2 toegevoegd, 0 overgeslagen.');
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await page.fill('#document-search', ' ARCHIEF ');
  await page.selectOption('#document-filter', 'draft');
  await expect(page.locator('[data-document-list] button')).toHaveText(['Rapport']);
  await expect(page.locator('[data-result-count]')).toHaveText('1 van 2 documenten');
  await expect(page.locator('#title')).toHaveValue('Plan');
  await expect(page.locator('.quote-meta')).toHaveText('Archief · historisch');
  await page.fill('#document-search', 'geen resultaat');
  await expect(page.locator('[data-library-empty]')).toHaveText('Geen documenten gevonden.');
  await page.fill('#document-search', '');
  await page.selectOption('#document-filter', '');
  await expect(page.locator('[data-document-list] button')).toHaveCount(2);
});

test('download includes hidden documents and can restore them in a fresh browser', async ({ page, browser }) => {
  await page.goto('/rio/local-qa.html');
  await uploadBackup(page, { version: 1, documents: [backupDoc('a', 'Plan'), backupDoc('b', 'Historie', 'historisch')] });
  await expect(page.locator('[data-backup-status]')).toContainText('2 toegevoegd');
  await page.fill('#document-search', 'Plan');
  const downloadPromise = page.waitForEvent('download');
  await page.click('#export-documents');
  const download = await downloadPromise;
  const path = await download.path();
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await other.goto('http://127.0.0.1:4173/rio/local-qa.html');
    await other.locator('#import-documents').setInputFiles(path);
    await expect(other.locator('[data-backup-status]')).toHaveText('2 toegevoegd, 0 overgeslagen.');
    await other.reload();
    await other.getByRole('button', { name: 'Historie', exact: true }).click();
    await expect(other.locator('.quote-meta')).toHaveText('Archief · historisch');
    await expect(other.locator('.quote-disclaimer')).toHaveText('gebruikersopgave — niet geverifieerd');
    await other.locator('#import-documents').setInputFiles(path);
    await expect(other.locator('[data-backup-status]')).toHaveText('0 toegevoegd, 2 overgeslagen.');
  } finally {
    await context.close();
  }
});

test('invalid and conflicting imports leave storage and editor unchanged', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await uploadBackup(page, { version: 1, documents: [backupDoc('a', 'Bestaand')] });
  await expect(page.locator('[data-backup-status]')).toContainText('1 toegevoegd');
  await page.getByRole('button', { name: 'Bestaand', exact: true }).click();
  await page.fill('#content', 'Nog niet opgeslagen');
  const before = await page.evaluate(() => localStorage.getItem('local-qa.documents.v1'));
  await uploadBackup(page, '{');
  await expect(page.locator('[data-backup-error]')).toContainText('geldige JSON');
  await uploadBackup(page, { version: 1, documents: [backupDoc('b'), backupDoc('a', 'Conflict')] });
  await expect(page.locator('[data-backup-error]')).toContainText('Conflict');
  expect(await page.evaluate(() => localStorage.getItem('local-qa.documents.v1'))).toBe(before);
  await expect(page.locator('#content')).toHaveValue('Nog niet opgeslagen');
  await expect(page.locator('[data-document-list] button')).toHaveCount(1);
});

test('failed import write does not claim success or render imported documents', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; });
  await uploadBackup(page, { version: 1, documents: [backupDoc('a')] });
  await expect(page.locator('[data-backup-error]')).toContainText('Niet opgeslagen');
  await expect(page.locator('[data-backup-status]')).toBeEmpty();
  await expect(page.locator('[data-document-list] button')).toHaveCount(0);
});
