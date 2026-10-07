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
    await page.selectOption('#status', 'invalid-status');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-error-box]')).toContainText('Ongeldige status');
  });
});
