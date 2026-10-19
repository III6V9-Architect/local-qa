import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.describe('local qa metadata flow', () => {
  test('invoer -> citaat -> label zichtbaar', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/rio/local-qa.html');

    await page.fill('#title', 'Bureau document');
    await page.fill('#content', 'Dit is een testcitaat uit het document.');
    await page.fill('#origin', 'Bureau A');
    await page.selectOption('#status', 'historisch');
    await page.locator('#document-form button[type="submit"]').click();

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
    await page.locator('#document-form button[type="submit"]').click();

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
  await page.locator('#document-form button[type="submit"]').click();
  for (const content of ['', '   ']) {
    await page.fill('#content', content);
    await page.locator('#document-form button[type="submit"]').click();
    await expect(page.locator('[data-error-box]')).toHaveText('Documentinhoud is vereist.');
    await expect(page.locator('blockquote')).toHaveText('Eerste inhoud');
  }
  await page.fill('#title', '   ');
  await page.fill('#content', 'Nieuwe inhoud');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-error-box]')).toHaveText('Documenttitel is vereist.');
  await page.fill('#title', 'Nieuw document');
  await page.fill('#origin', 'Bron B');
  await page.selectOption('#status', 'specificatie');
  await page.locator('#document-form button[type="submit"]').click();
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
    await page.locator('#document-form button[type="submit"]').click();
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
  await page.locator('#document-form button[type="submit"]').click();
  await page.fill('#content', '');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-error-box]')).not.toBeEmpty();
  page.once('dialog', (dialog) => dialog.accept());
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
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('blockquote')).toHaveText('Na reset');
  await expect(page.locator('.quote-meta')).toHaveText('Nieuwe bron · draft');
});


test('multiple documents survive reload, support edits and persistent deletion', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page, 'Inhoud A');
  await page.fill('#title', 'Document A');
  await page.selectOption('#status', 'historisch');
  await page.locator('#document-form button[type="submit"]').click();
  await page.click('#reset-document');
  await fillDocument(page, 'Inhoud B');
  await page.fill('#title', 'Document B');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-document-list] button')).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: 'Document A', exact: true }).click();
  await expect(page.locator('#status')).toHaveValue('historisch');
  await expect(page.locator('blockquote')).toHaveText('Inhoud A');
  await expect(page.locator('.quote-disclaimer')).toHaveText('gebruikersopgave — niet geverifieerd');
  await page.fill('#content', 'A gewijzigd');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('blockquote')).toHaveText('A gewijzigd');
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
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-error-box]')).toContainText('beschadigd');
  await expect(page.locator('[data-document-list] button')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('local-qa.documents.v1'))).toBe('{broken');
});

test('quota failure preserves the previous quote and editable input', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; });
  await page.fill('#content', 'Niet opgeslagen');
  await page.locator('#document-form button[type="submit"]').click();
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
  await page.locator('#document-form button[type="submit"]').click();
  await fillDocument(other, 'Ander tabblad');
  await other.locator('#document-form button[type="submit"]').click();
  await expect(other.locator('[data-error-box]')).toContainText('ander tabblad');
  await other.reload();
  await expect(other.locator('[data-document-list] button')).toHaveCount(1);
});

async function uploadBackup(page, data) {
  await expect(page.locator('#import-documents')).toBeEnabled();
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

test('question retrieves source passages across filters and opens the source', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  const source = { ...backupDoc('qa', 'Waterrapport', 'historisch'), content: 'Inleiding.\n\nWaterkwaliteit is niet vastgesteld.' };
  await uploadBackup(page, { version: 1, documents: [source] });
  await expect(page.locator('[data-backup-status]')).toContainText('1 toegevoegd');
  await page.fill('#document-search', 'verbergt alles');
  await page.fill('#question', 'Wat is de waterkwaliteit?');
  await page.locator('#question').press('Enter');
  const card = page.locator('[data-testid="passage-card"]');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Waterrapport — alinea 2');
  await expect(card).toContainText('Archief · historisch');
  await expect(card).toContainText('gebruikersopgave — niet geverifieerd');
  await expect(card.locator('blockquote')).toHaveText('Waterkwaliteit is niet vastgesteld.');
  await card.getByRole('button', { name: 'Open brondocument' }).click();
  await expect(page.locator('#title')).toHaveValue('Waterrapport');
  await expect(page.locator('#content')).toHaveValue(source.content);
  await expect(page.locator('#title')).toBeFocused();
});

test('question results refresh on edit, import and delete', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page, 'Water is aanwezig.');
  await page.locator('#document-form button[type="submit"]').click();
  await page.fill('#question', 'water');
  await page.getByRole('button', { name: 'Zoek passages' }).click();
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(1);
  await page.fill('#content', 'Zand is aanwezig.');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(0);
  await expect(page.locator('[data-question-status]')).toContainText('Geen passende passages');
  await uploadBackup(page, { version: 1, documents: [{ ...backupDoc('qa-new', 'Nieuw water'), content: 'Water keert terug.' }] });
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(1);
  await page.locator('[data-testid="passage-card"]').getByRole('button', { name: 'Open brondocument' }).click();
  await page.click('#delete-document');
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(0);
});

test('question has clear empty states and safely renders imported markup', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await page.fill('#question', 'wat is de');
  await page.getByRole('button', { name: 'Zoek passages' }).click();
  await expect(page.locator('[data-question-status]')).toContainText('zoekwoord');
  await page.fill('#question', 'water');
  await page.getByRole('button', { name: 'Zoek passages' }).click();
  await expect(page.locator('[data-question-status]')).toContainText('Geen passende passages');
  const source = { ...backupDoc('markup', '<img src=x>'), content: 'Water <img src=x onerror="window.injected=true">' };
  await uploadBackup(page, { version: 1, documents: [source] });
  const card = page.locator('[data-testid="passage-card"]');
  await expect(card.locator('blockquote')).toHaveText(source.content);
  await expect(card.locator('img')).toHaveCount(0);
  await page.fill('#question', 'zand');
  await expect(card).toHaveCount(0);
});

test('switch and reset ask before discarding edits; same-document selection preserves them', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await uploadBackup(page, { version: 1, documents: [backupDoc('a', 'Document A'), backupDoc('b', 'Document B')] });
  await expect(page.locator('[data-backup-status]')).toContainText('2 toegevoegd');
  await page.getByRole('button', { name: 'Document A', exact: true }).click();
  await page.fill('#content', 'Concept blijft');
  await expect(page.locator('[data-dirty-status]')).toHaveText('Niet-opgeslagen wijzigingen');
  await page.getByRole('button', { name: 'Document A', exact: true }).click();
  await expect(page.locator('#content')).toHaveValue('Concept blijft');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Document B', exact: true }).click();
  await expect(page.locator('#title')).toHaveValue('Document A');
  await expect(page.locator('#content')).toHaveValue('Concept blijft');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.click('#reset-document');
  await expect(page.locator('#content')).toHaveValue('Concept blijft');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Document B', exact: true }).click();
  await expect(page.locator('#title')).toHaveValue('Document B');
  await expect(page.locator('[data-dirty-status]')).toBeEmpty();
});

test('source opening protects unsaved new-document input', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await uploadBackup(page, { version: 1, documents: [backupDoc('a', 'Bron')] });
  await expect(page.locator('[data-backup-status]')).toContainText('1 toegevoegd');
  await page.fill('#question', 'archief');
  await page.getByRole('button', { name: 'Zoek passages' }).click();
  await page.fill('#title', 'Nieuw concept');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Open brondocument' }).click();
  await expect(page.locator('#title')).toHaveValue('Nieuw concept');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Open brondocument' }).click();
  await expect(page.locator('#title')).toHaveValue('Bron');
});

test('delete cancellation and undo preserve the current draft and restore search results', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page, 'Water in bron');
  await page.locator('#document-form button[type="submit"]').click();
  await page.fill('#question', 'water');
  await page.getByRole('button', { name: 'Zoek passages' }).click();
  await page.fill('#content', 'Niet opgeslagen wijziging');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.click('#delete-document');
  await expect(page.locator('[data-document-list] button')).toHaveCount(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#delete-document');
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(0);
  await page.fill('#title', 'Nieuw concept');
  await page.click('#undo-delete');
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(1);
  await expect(page.locator('#title')).toHaveValue('Nieuw concept');
  await expect(page.locator('#undo-delete')).toBeHidden();
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: 'Document', exact: true }).click();
  await expect(page.locator('#content')).toHaveValue('Water in bron');
});

test('undo storage failure keeps recovery available and can be retried', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.locator('#document-form button[type="submit"]').click();
  await page.click('#delete-document');
  await expect(page.locator('[data-save-status]')).toHaveText('Document verwijderd.');
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
  });
  await page.click('#undo-delete');
  await expect(page.locator('[data-error-box]')).toContainText('Niet opgeslagen');
  await expect(page.locator('#undo-delete')).toBeVisible();
  await expect(page.locator('[data-document-list] button')).toHaveCount(0);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
  await page.click('#undo-delete');
  await expect(page.locator('[data-document-list] button')).toHaveCount(1);
  await expect(page.locator('[data-error-box]')).toBeEmpty();
});

test('undo rejects changes from another tab and unload guard only protects dirty input', async ({ page, context }) => {
  await page.goto('/rio/local-qa.html');
  const unloadCancelled = () => page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(await unloadCancelled()).toBe(false);
  await fillDocument(page);
  expect(await unloadCancelled()).toBe(true);
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  expect(await unloadCancelled()).toBe(false);
  await page.click('#delete-document');
  await expect(page.locator('[data-save-status]')).toHaveText('Document verwijderd.');
  const other = await context.newPage();
  await other.goto('/rio/local-qa.html');
  await fillDocument(other, 'Wijziging uit tweede tab');
  await other.locator('#document-form button[type="submit"]').click();
  await expect(other.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  await page.click('#undo-delete');
  await expect(page.locator('[data-error-box]')).toContainText('ander tabblad');
  await expect(page.locator('#undo-delete')).toBeVisible();
  await expect(page.locator('[data-document-list] button')).toHaveCount(0);
  await other.reload();
  await expect(other.locator('[data-document-list] button')).toHaveCount(1);
});

async function openTextFile(page, name, content) {
  await expect(page.locator('#open-text-file')).toBeEnabled();
  await page.locator('#open-text-file').setInputFiles({
    name, mimeType: 'text/plain', buffer: Buffer.isBuffer(content) ? content : Buffer.from(content),
  });
}

test('text file opens as a new unsaved document and becomes searchable only after save', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page, 'Oude inhoud');
  await page.locator('#document-form button[type="submit"]').click();
  await openTextFile(page, 'Water.md', '# Rapport\n\nWaterkwaliteit is gemeten.');
  await expect(page.locator('[data-file-status]')).toContainText('geopend als nieuw document');
  await expect(page.locator('#title')).toHaveValue('Water');
  await expect(page.locator('#origin')).toHaveValue('Water.md');
  await expect(page.locator('#status')).toHaveValue('draft');
  await expect(page.locator('[data-dirty-status]')).toContainText('Niet-opgeslagen');
  await expect(page.locator('[data-document-list] button')).toHaveCount(1);
  await page.fill('#question', 'waterkwaliteit');
  await page.getByRole('button', { name: 'Zoek passages' }).click();
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(0);
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-document-list] button')).toHaveCount(2);
  await expect(page.locator('[data-testid="passage-card"]')).toContainText('Water.md · draft');
  await expect(page.locator('[data-dirty-status]')).toBeEmpty();
  await page.reload();
  await page.getByRole('button', { name: 'Document', exact: true }).click();
  await expect(page.locator('#content')).toHaveValue('Oude inhoud');
  await page.getByRole('button', { name: 'Water', exact: true }).click();
  await expect(page.locator('#content')).toHaveValue('# Rapport\n\nWaterkwaliteit is gemeten.');
});

test('opening a file can be cancelled and retried without losing draft text', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page, 'Mijn concept');
  page.once('dialog', (dialog) => dialog.dismiss());
  await openTextFile(page, 'nieuw.txt', 'Nieuwe tekst');
  await expect(page.locator('[data-file-status]')).toContainText('geannuleerd');
  await expect(page.locator('#content')).toHaveValue('Mijn concept');
  page.once('dialog', (dialog) => dialog.accept());
  await openTextFile(page, 'nieuw.txt', 'Nieuwe tekst');
  await expect(page.locator('#content')).toHaveValue('Nieuwe tekst');
  await expect(page.locator('[data-document-list] button')).toHaveCount(0);
});

test('invalid files and read failures preserve the editor and collection', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page, 'Behoud deze tekst');
  await page.locator('#document-form button[type="submit"]').click();
  for (const [name, content, message] of [
    ['test.pdf', 'PDF', 'niet ondersteund'],
    ['test.txt', Buffer.from([0xc3, 0x28]), 'UTF-8'],
    ['test.txt', 'a\0b', 'binaire'],
    ['test.txt', '   ', 'Documentinhoud'],
    ['test.txt', Buffer.alloc(1024 * 1024 + 1, 65), 'te groot'],
  ]) {
    await openTextFile(page, name, content);
    await expect(page.locator('[data-file-error]')).toContainText(message);
    await expect(page.locator('#content')).toHaveValue('Behoud deze tekst');
    await expect(page.locator('[data-document-list] button')).toHaveCount(1);
  }
  await page.evaluate(() => { File.prototype.arrayBuffer = async () => { throw new Error('Leesfout'); }; });
  await openTextFile(page, 'test.txt', 'tekst');
  await expect(page.locator('[data-file-error]')).toContainText('Leesfout');
  await expect(page.locator('#open-text-file')).toBeEnabled();
  await expect(page.locator('#content')).toHaveValue('Behoud deze tekst');
});

test('Markdown markup is displayed as text after save', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  const content = '# Titel\n\n<img src=x onerror="window.injected=true">';
  await openTextFile(page, 'tekst.md', content);
  await expect(page.locator('#content')).toHaveValue(content);
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-testid="quote-card"] blockquote')).toHaveText(content);
  await expect(page.locator('[data-testid="quote-card"] img')).toHaveCount(0);
});

test('edits made while a file is being read still require discard confirmation', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      return new Promise((resolve) => { window.finishFileRead = async () => resolve(await original.call(this)); });
    };
  });
  await openTextFile(page, 'later.txt', 'Bestandstekst');
  await expect(page.locator('#open-text-file')).toBeDisabled();
  await page.fill('#content', 'Getypt tijdens lezen');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.evaluate(() => window.finishFileRead());
  await expect(page.locator('[data-file-status]')).toContainText('geannuleerd');
  await expect(page.locator('#content')).toHaveValue('Getypt tijdens lezen');
});

async function prepareCitationSearch(page) {
  await page.goto('/rio/local-qa.html');
  await uploadBackup(page, { version: 1, documents: [
    { ...backupDoc('citation-a', 'Waterbron', 'historisch'), content: 'Inleiding.\n\nWater is niet geverifieerd.' },
    { ...backupDoc('citation-b', 'Tweede bron'), content: 'Water in tweede bron.' },
  ] });
  await expect(page.locator('[data-backup-status]')).toContainText('2 toegevoegd');
  await page.fill('#question', 'Wat staat er over water?');
  await page.getByRole('button', { name: 'Zoek passages' }).click();
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(2);
}

test('copy includes the exact citation and provenance', async ({ page }) => {
  await prepareCitationSearch(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: async (text) => { window.copiedCitation = text; } },
  }));
  const card = page.locator('[data-testid="passage-card"]').first();
  await card.getByRole('button', { name: 'Kopieer citaat met bron' }).click();
  await expect(card.getByRole('status')).toHaveText('Citaat met bronvermelding gekopieerd.');
  const copied = await page.evaluate(() => window.copiedCitation);
  expect(copied).toContain('Document: Waterbron');
  expect(copied).toContain('Document-ID: citation-a');
  expect(copied).toContain('Alinea: 2');
  expect(copied).toContain('Herkomst: Archief');
  expect(copied).toContain('Status: historisch');
  expect(copied).toContain('gebruikersopgave — niet geverifieerd');
  expect(copied).toContain('Citaat:\nWater is niet geverifieerd.');
});

test('blocked clipboard exposes a selected read-only citation for manual copying', async ({ page }) => {
  await prepareCitationSearch(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: async () => { throw new Error('Permission denied'); } },
  }));
  const card = page.locator('[data-testid="passage-card"]').first();
  await card.getByRole('button', { name: 'Kopieer citaat met bron' }).click();
  await expect(card.getByRole('status')).toContainText('Kopieer de geselecteerde tekst');
  const fallback = card.getByRole('textbox', { name: 'Citaat met bronvermelding handmatig kopiëren' });
  await expect(fallback).toBeVisible();
  await expect(fallback).toBeFocused();
  expect(await fallback.evaluate((element) => element.readOnly)).toBe(true);
  const selected = await fallback.evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd));
  expect(selected).toBe(await fallback.inputValue());
  expect(selected).toContain('gebruikersopgave — niet geverifieerd');
  expect(selected).toContain('Water is niet geverifieerd.');
  await expect(card.getByRole('button', { name: 'Kopieer citaat met bron' })).toBeEnabled();
});

test('download contains the submitted question and every current source', async ({ page }) => {
  await prepareCitationSearch(page);
  await page.fill('#document-search', 'geen zichtbare documenten');
  const pending = page.waitForEvent('download');
  await page.click('#export-passages');
  const download = await pending;
  expect(download.suggestedFilename()).toBe('local-qa-passages.txt');
  const text = await readFile(await download.path(), 'utf8');
  expect(text).toContain('Vraag: Wat staat er over water?');
  expect(text).toContain('Aantal passages: 2');
  expect(text).toContain('Document-ID: citation-a');
  expect(text).toContain('Document-ID: citation-b');
  expect(text.split('gebruikersopgave — niet geverifieerd')).toHaveLength(3);
  expect(text).toContain('Water is niet geverifieerd.');
  expect(text).toContain('Water in tweede bron.');
  await page.fill('#question', 'nieuwe vraag');
  await expect(page.locator('#export-passages')).toBeDisabled();
});

test('export refreshes after saved edits and disables when sources disappear', async ({ page }) => {
  await prepareCitationSearch(page);
  await page.getByRole('button', { name: 'Waterbron', exact: true }).click();
  await page.fill('#content', 'Water is gewijzigd.');
  await page.locator('#document-form button[type="submit"]').click();
  await page.getByRole('button', { name: 'Tweede bron', exact: true }).click();
  await page.click('#delete-document');
  const pending = page.waitForEvent('download');
  await page.click('#export-passages');
  const text = await readFile(await (await pending).path(), 'utf8');
  expect(text).toContain('Aantal passages: 1');
  expect(text).toContain('Water is gewijzigd.');
  expect(text).not.toContain('Document-ID: citation-b');
  expect(text).not.toContain('Water is niet geverifieerd.');
  await page.getByRole('button', { name: 'Waterbron', exact: true }).click();
  await page.click('#delete-document');
  await expect(page.locator('#export-passages')).toBeDisabled();
});

test('question status and all-word filters rerun the submitted search and export criteria', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await uploadBackup(page, { version: 1, documents: [
    { ...backupDoc('any', 'Deelmatch'), content: 'Water alleen.' },
    { ...backupDoc('all', 'Volledige match', 'specificatie'), content: 'Water kwaliteit.' },
    { ...backupDoc('old', 'Historie', 'historisch'), content: 'Water kwaliteit vroeger.' },
  ] });
  await expect(page.locator('[data-backup-status]')).toContainText('3 toegevoegd');
  await page.fill('#question', 'water kwaliteit');
  await page.getByRole('button', { name: 'Zoek passages' }).click();
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(3);
  await page.selectOption('#question-match', 'all');
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(2);
  await page.selectOption('#question-status-filter', 'specificatie');
  const card = page.locator('[data-testid="passage-card"]');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Volledige match');
  await expect(card).toContainText('Gevonden woorden (2 van 2): water, kwaliteit');
  const pending = page.waitForEvent('download');
  await page.click('#export-passages');
  const text = await readFile(await (await pending).path(), 'utf8');
  expect(text).toContain('Statusfilter: specificatie');
  expect(text).toContain('Zoekmodus: alle zoekwoorden');
  expect(text).toContain('Document-ID: all');
  expect(text).not.toContain('Document-ID: old');
  await page.selectOption('#question-status-filter', 'draft');
  await expect(card).toHaveCount(0);
  await expect(page.locator('#export-passages')).toBeDisabled();
  await page.selectOption('#question-match', 'any');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Deelmatch');
});

test('highlighted Unicode passages preserve literal text and copy without markup', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  const content = 'Cafe\u0301, CAFÉ! <img src=x> waterkwaliteit water.';
  await uploadBackup(page, { version: 1, documents: [{ ...backupDoc('unicode'), content }] });
  await expect(page.locator('[data-backup-status]')).toContainText('1 toegevoegd');
  await page.fill('#question', 'café water');
  await page.getByRole('button', { name: 'Zoek passages' }).click();
  const card = page.locator('[data-testid="passage-card"]');
  expect(await card.locator('blockquote').textContent()).toBe(content);
  await expect(card.locator('mark')).toHaveText(['Cafe\u0301', 'CAFÉ', 'water']);
  await expect(card.locator('img')).toHaveCount(0);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: async (text) => { window.copiedCitation = text; } },
  }));
  await card.getByRole('button', { name: 'Kopieer citaat met bron' }).click();
  await expect(card.getByRole('status')).toContainText('gekopieerd');
  const text = await page.evaluate(() => window.copiedCitation);
  expect(text).toContain(content);
  expect(text).not.toContain('<mark>');
});

test('question filter follows saved status changes while keeping collection filters independent', async ({ page }) => {
  await prepareCitationSearch(page);
  await page.selectOption('#question-status-filter', 'historisch');
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(1);
  await page.selectOption('#document-filter', 'draft');
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(1);
  await page.locator('[data-testid="passage-card"]').getByRole('button', { name: 'Open brondocument' }).click();
  await page.selectOption('#status', 'specificatie');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(0);
  await page.selectOption('#question-status-filter', 'specificatie');
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(1);
  await page.fill('#question', 'nieuwe vraag');
  await page.selectOption('#question-match', 'all');
  await expect(page.locator('[data-testid="passage-card"]')).toHaveCount(0);
  await expect(page.locator('#export-passages')).toBeDisabled();
});

test('new incomplete draft can be recovered after reload and cleared by save', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await page.fill('#content', 'Concept zonder titel');
  await expect(page.locator('[data-draft-status]')).toContainText('tijdelijk bewaard');
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.locator('[data-draft-recovery]')).toBeVisible();
  await expect(page.locator('#content')).toHaveValue('');
  await page.click('#restore-draft');
  await expect(page.locator('#content')).toHaveValue('Concept zonder titel');
  await expect(page.locator('[data-dirty-status]')).toContainText('Niet-opgeslagen');
  await page.fill('#title', 'Hersteld document');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  await page.reload();
  await expect(page.locator('[data-draft-recovery]')).toBeHidden();
  await page.getByRole('button', { name: 'Hersteld document', exact: true }).click();
  await expect(page.locator('#content')).toHaveValue('Concept zonder titel');
});

test('existing-document draft recovers as an update when its source is unchanged', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page, 'Opgeslagen tekst');
  await page.locator('#document-form button[type="submit"]').click();
  await page.fill('#content', 'Conceptwijziging');
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await page.click('#restore-draft');
  await expect(page.locator('#content')).toHaveValue('Conceptwijziging');
  await expect(page.locator('[data-testid="quote-card"] blockquote')).toHaveText('Opgeslagen tekst');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-document-list] button')).toHaveCount(1);
  await expect(page.locator('[data-testid="quote-card"] blockquote')).toHaveText('Conceptwijziging');
});

test('draft recovery makes a copy if another tab changed the original', async ({ page, context }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page, 'Oorspronkelijk');
  await page.locator('#document-form button[type="submit"]').click();
  await page.fill('#content', 'Mijn concept');
  const other = await context.newPage();
  await other.goto('/rio/local-qa.html');
  await other.getByRole('button', { name: 'Document', exact: true }).click();
  await other.fill('#content', 'Nieuwere bron');
  await other.locator('#document-form button[type="submit"]').click();
  await expect(other.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await page.click('#restore-draft');
  await expect(page.locator('[data-save-status]')).toContainText('hersteld als nieuw document');
  await expect(page.locator('#content')).toHaveValue('Mijn concept');
  await page.fill('#title', 'Herstelde kopie');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-document-list] button')).toHaveCount(2);
  await page.getByRole('button', { name: 'Document', exact: true }).click();
  await expect(page.locator('#content')).toHaveValue('Nieuwere bron');
});

test('pending and corrupt recovery records stay intact until an explicit choice', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await page.fill('#content', 'Bewaard concept');
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  const before = await page.evaluate(() => sessionStorage.getItem('local-qa.editor-draft.v1'));
  await page.fill('#content', 'Nieuwe invoer');
  expect(await page.evaluate(() => sessionStorage.getItem('local-qa.editor-draft.v1'))).toBe(before);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.click('#restore-draft');
  await expect(page.locator('#content')).toHaveValue('Nieuwe invoer');
  await page.click('#discard-draft');
  await expect(page.locator('[data-draft-recovery]')).toBeHidden();
  await expect(page.locator('#content')).toHaveValue('Nieuwe invoer');
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#reset-document');
  await page.evaluate(() => sessionStorage.setItem('local-qa.editor-draft.v1', '{broken'));
  await page.reload();
  await expect(page.locator('[data-recovery-message]')).toContainText('beschadigd');
  await expect(page.locator('#restore-draft')).toBeDisabled();
  await page.fill('#content', 'Invoer na beschadiging');
  expect(await page.evaluate(() => sessionStorage.getItem('local-qa.editor-draft.v1'))).toBe('{broken');
  await page.click('#discard-draft');
  await expect(page.locator('[data-draft-recovery]')).toBeHidden();
  await expect(page.locator('#content')).toHaveValue('Invoer na beschadiging');
  await expect(page.locator('[data-draft-status]')).toContainText('tijdelijk bewaard');
});

test('session storage write failure leaves the editor usable', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'local-qa.editor-draft.v1') throw new Error('Quota');
      return original.call(this, key, value);
    };
  });
  await fillDocument(page, 'Nog steeds bewerkbaar');
  await expect(page.locator('[data-draft-status]')).toContainText('kon niet tijdelijk worden bewaard');
  await expect(page.locator('#content')).toHaveValue('Nog steeds bewerkbaar');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-document-list] button')).toHaveCount(1);
  await expect(page.locator('[data-dirty-status]')).toBeEmpty();
});

test('another tab holding the write lock preserves the draft and permits retry', async ({ page, context }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page, 'Te bewaren concept');
  const other = await context.newPage();
  await other.goto('/rio/local-qa.html');
  await other.evaluate(() => new Promise((ready) => {
    window.heldLock = navigator.locks.request('local-qa.documents.v1.write', () => new Promise((release) => {
      window.releaseWriteLock = release;
      ready();
    }));
  }));
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-error-box]')).toContainText('ander tabblad slaat nu op');
  await expect(page.locator('#content')).toBeEnabled();
  await expect(page.locator('#content')).toHaveValue('Te bewaren concept');
  expect(await page.evaluate(() => localStorage.getItem('local-qa.documents.v1'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('local-qa.editor-draft.v1'))).toContain('Te bewaren concept');
  await other.evaluate(async () => { window.releaseWriteLock(); await window.heldLock; });
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  await expect(page.locator('[data-error-box]')).toBeEmpty();
});

test('controls stay disabled until the asynchronous write commits', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.evaluate(() => {
    const request = navigator.locks.request.bind(navigator.locks);
    navigator.locks.request = (name, options, callback) => request(name, options, async (lock) => {
      await new Promise((resolve) => { window.finishWrite = resolve; });
      return callback(lock);
    });
  });
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('#app-controls')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#content')).toBeDisabled();
  await expect(page.locator('#reset-document')).toBeDisabled();
  await expect(page.locator('[data-save-status]')).toBeEmpty();
  await page.waitForFunction(() => typeof window.finishWrite === 'function');
  await page.evaluate(() => window.finishWrite());
  await expect(page.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  await expect(page.locator('#content')).toBeEnabled();
  await expect(page.locator('#app-controls')).toHaveAttribute('aria-busy', 'false');
});

test('missing Web Locks fails safely without losing editor input', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await page.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-error-box]')).toContainText('Web Locks');
  await expect(page.locator('#content')).toBeEnabled();
  await expect(page.locator('#content')).toHaveValue('Eerste inhoud');
  await expect(page.locator('[data-save-status]')).toBeEmpty();
  expect(await page.evaluate(() => localStorage.getItem('local-qa.documents.v1'))).toBeNull();
});

test('refresh preserves a conflicting draft as a new document and updates citations', async ({ page, context }) => {
  await page.goto('/rio/local-qa.html');
  await uploadBackup(page, { version: 1, documents: [backupDoc('a', 'Bron')] });
  await expect(page.locator('[data-backup-status]')).toContainText('1 toegevoegd');
  await page.getByRole('button', { name: 'Bron', exact: true }).click();
  await page.fill('#content', 'Mijn lokale concept');
  const other = await context.newPage();
  await other.goto('/rio/local-qa.html');
  await other.getByRole('button', { name: 'Bron', exact: true }).click();
  await other.fill('#content', 'Nieuwere broninhoud');
  await other.locator('#document-form button[type="submit"]').click();
  await expect(other.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  await expect(page.locator('#refresh-documents')).toBeVisible();
  await page.click('#refresh-documents');
  await expect(page.locator('[data-sync-status]')).toContainText('als nieuw document');
  await expect(page.locator('#content')).toHaveValue('Mijn lokale concept');
  await expect(page.locator('[data-testid="quote-card"]')).toHaveCount(0);
  await page.fill('#title', 'Mijn kopie');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-document-list] button')).toHaveCount(2);
  await page.getByRole('button', { name: 'Bron', exact: true }).click();
  await expect(page.locator('blockquote')).toHaveText('Nieuwere broninhoud');
});

test('refresh keeps an unchanged source attached to its draft', async ({ page, context }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  await page.fill('#content', 'Lokale bewerking');
  const other = await context.newPage();
  await other.goto('/rio/local-qa.html');
  await uploadBackup(other, { version: 1, documents: [backupDoc('other', 'Ander')] });
  await expect(page.locator('#refresh-documents')).toBeVisible();
  await page.click('#refresh-documents');
  await expect(page.locator('#content')).toHaveValue('Lokale bewerking');
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  await expect(page.locator('[data-document-list] button')).toHaveCount(2);
  await expect(page.locator('blockquote')).toHaveText('Lokale bewerking');
});

test('refresh rejects corrupt storage, retries after repair and handles clear', async ({ page, context }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  const other = await context.newPage();
  await other.goto('/rio/local-qa.html');
  const saved = await other.evaluate(() => localStorage.getItem('local-qa.documents.v1'));
  await other.evaluate(() => localStorage.setItem('local-qa.documents.v1', '{broken'));
  await page.click('#refresh-documents');
  await expect(page.locator('[data-sync-status]')).toContainText('Bijwerken mislukt');
  await expect(page.locator('blockquote')).toHaveText('Eerste inhoud');
  await other.evaluate((raw) => localStorage.setItem('local-qa.documents.v1', raw), saved);
  await page.click('#refresh-documents');
  await expect(page.locator('[data-sync-status]')).toContainText('Documenten bijgewerkt');
  await other.evaluate(() => localStorage.clear());
  await page.click('#refresh-documents');
  await expect(page.locator('[data-document-list] button')).toHaveCount(0);
  await expect(page.locator('#content')).toHaveValue('');
  await expect(page.locator('[data-testid="quote-card"]')).toHaveCount(0);
});

test('stale backup export is blocked until refresh, preserving unsaved input', async ({ page, context }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  await page.fill('#content', 'Nog niet opgeslagen concept');
  const other = await context.newPage();
  await other.goto('/rio/local-qa.html');
  await uploadBackup(other, { version: 1, documents: [backupDoc('extra', 'Nieuwe bron')] });
  await expect(other.locator('[data-backup-status]')).toContainText('1 toegevoegd');
  const downloads = [];
  page.on('download', (download) => downloads.push(download));
  await page.click('#export-documents');
  await expect(page.locator('[data-backup-error]')).toContainText('Back-up niet gemaakt');
  await expect(page.locator('[data-backup-status]')).toBeEmpty();
  expect(downloads).toHaveLength(0);
  await expect(page.locator('#content')).toHaveValue('Nog niet opgeslagen concept');
  await page.click('#refresh-documents');
  await expect(page.locator('[data-document-list] button')).toHaveCount(2);
  const download = page.waitForEvent('download');
  await page.click('#export-documents');
  const backup = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  expect(backup.documents.map((doc) => doc.title)).toEqual(['Document', 'Nieuwe bron']);
  expect(backup.documents[0].content).toBe('Eerste inhoud');
  await expect(page.locator('#content')).toHaveValue('Nog niet opgeslagen concept');
  await expect(page.locator('[data-backup-error]')).toBeEmpty();
});

test('export detects corrupt storage even without a storage event', async ({ page }) => {
  await page.goto('/rio/local-qa.html');
  await fillDocument(page);
  await page.locator('#document-form button[type="submit"]').click();
  await expect(page.locator('[data-save-status]')).toHaveText('Document lokaal opgeslagen.');
  await page.evaluate(() => localStorage.setItem('local-qa.documents.v1', '{broken'));
  await expect(page.locator('#refresh-documents')).toBeHidden();
  const downloads = [];
  page.on('download', (download) => downloads.push(download));
  await page.click('#export-documents');
  await expect(page.locator('[data-backup-error]')).toContainText('Back-up niet gemaakt');
  await expect(page.locator('#refresh-documents')).toBeVisible();
  expect(downloads).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem('local-qa.documents.v1'))).toBe('{broken');
  await expect(page.locator('#content')).toHaveValue('Eerste inhoud');
});
