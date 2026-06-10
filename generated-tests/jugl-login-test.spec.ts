import { test, expect } from '@playwright/test';

test('Jugl Login Test', async ({ page }) => {
  // await page.goto('https://web-dev.jugl.com/login');
  await page.goto("https://web-dev.jugl.com/login");

  // await page.getByRole('button', { name: 'Phone' }).click();
  await page.getByRole('button', { name: 'Phone' }).click();

  // await page.getByRole('textbox', { name: 'Enter Phone Number' }).click();
  await page.getByRole('textbox', { name: 'Enter Phone Number' }).click();

  // await page.getByRole('textbox', { name: 'Enter Phone Number' }).fill('0009090000');
  await page.getByRole('textbox', { name: 'Enter Phone Number' }).fill("0009090000");

  // await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // await page.getByRole('textbox', { name: 'Please enter OTP character 1' }).fill('2');
  await page.getByRole('textbox', { name: 'Please enter OTP character 1' }).fill("2");

  // await page.getByRole('textbox', { name: 'Please enter OTP character 2' }).fill('6');
  await page.getByRole('textbox', { name: 'Please enter OTP character 2' }).fill("6");

  // await page.getByRole('textbox', { name: 'Please enter OTP character 3' }).fill('0');
  await page.getByRole('textbox', { name: 'Please enter OTP character 3' }).fill("0");

  // await page.getByRole('textbox', { name: 'Please enter OTP character 4' }).fill('6');
  await page.getByRole('textbox', { name: 'Please enter OTP character 4' }).fill("6");

  // await page.getByRole('textbox', { name: 'Please enter OTP character 5' }).fill('1');
  await page.getByRole('textbox', { name: 'Please enter OTP character 5' }).fill("1");

  // await page.getByRole('textbox', { name: 'Please enter OTP character 6' }).fill('0');
  await page.getByRole('textbox', { name: 'Please enter OTP character 6' }).fill("0");

  // await page.getByRole('button', { name: 'AI Agents' }).click();
  await page.getByRole('button', { name: 'AI Agents' }).click();

});
