import { test, expect } from '@playwright/test';

test('Jugl Login Test', async ({ page }) => {
  // Navigate to https://web-dev.jugl.com/
  await page.goto('https://web-dev.jugl.com/');

});
