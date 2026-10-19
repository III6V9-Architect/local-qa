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
