import type { GenerateRequest, TestStep } from '../types.js';

export function generateTestCode(request: GenerateRequest): string {
  const { testName, testDescription, steps, baseURL } = request;

  const lines: string[] = [];

  // Imports
  lines.push(`import { test, expect } from '@playwright/test';`);
  lines.push('');

  // Test block
  if (testDescription) {
    lines.push(`// ${testDescription}`);
  }
  lines.push(`test('${escapeSingleQuotes(testName)}', async ({ page }) => {`);

  // Sort steps by order
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  for (const step of sortedSteps) {
    const code = generateStepCode(step);
    if (step.description) {
      lines.push(`  // ${step.description}`);
    }
    lines.push(`  ${code}`);
    lines.push('');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

function generateStepCode(step: TestStep): string {
  const { type, selector, value } = step;
  const sel = escapeSingleQuotes(selector);
  const val = escapeSingleQuotes(value);

  switch (type) {
    case 'navigate': {
      let dest = val || sel;
      if (dest.startsWith('http')) {
        try {
          const urlObj = new URL(dest);
          dest = urlObj.pathname + urlObj.search;
        } catch (e) {}
      }
      return `await page.goto('${dest}');`;
    }

    case 'click':
      return `await ${resolveSelector(sel)}.click();`;

    case 'dblclick':
      return `await ${resolveSelector(sel)}.dblclick();`;

    case 'fill':
      if (step.delay !== undefined && step.delay > 0) {
        return `await ${resolveSelector(sel)}.pressSequentially('${val}', { delay: ${step.delay} });`;
      }
      return `await ${resolveSelector(sel)}.fill('${val}');`;

    case 'select':
      return `await ${resolveSelector(sel)}.selectOption('${val}');`;

    case 'check':
      return `await ${resolveSelector(sel)}.check();`;

    case 'uncheck':
      return `await ${resolveSelector(sel)}.uncheck();`;

    case 'upload':
      return `await ${resolveSelector(sel)}.setInputFiles('${val}');`;

    case 'hover':
      return `await ${resolveSelector(sel)}.hover();`;

    case 'press':
      return `await ${resolveSelector(sel)}.press('${val}');`;

    case 'waitForSelector':
      if (isPlaywrightLocator(sel)) {
        return `await ${sel}.waitFor({ state: 'visible'${value ? `, timeout: ${value}` : ''} });`;
      }
      return `await page.waitForSelector('${sel}'${value ? `, { timeout: ${value} }` : ''});`;

    case 'waitForTimeout':
      return `await page.waitForTimeout(${value || 1000});`;

    case 'assertVisible':
      return `await expect(${resolveSelector(sel)}).toBeVisible();`;

    case 'assertText':
      return `await expect(${resolveSelector(sel)}).toContainText('${val}');`;

    case 'assertValue':
      return `await expect(${resolveSelector(sel)}).toHaveValue('${val}');`;

    case 'assertUrl':
      return `await expect(page).toHaveURL(${val.startsWith('/') ? `/${val}/` : `'${val}'`});`;

    case 'screenshot':
      return `await page.screenshot({ path: '${val || 'screenshot.png'}', fullPage: true });`;

    case 'scrollTo':
      return `await ${resolveSelector(sel)}.scrollIntoViewIfNeeded();`;

    default:
      return `// Unknown step type: ${type}`;
  }
}

function resolveSelector(selector: string): string {
  // If it already looks like a Playwright locator (page.getByRole, page.locator, etc.)
  if (isPlaywrightLocator(selector)) {
    return selector;
  }

  // If it's a CSS selector
  return `page.locator('${selector}')`;
}

function isPlaywrightLocator(selector: string): boolean {
  return selector.startsWith('page.');
}

function escapeSingleQuotes(str: string): string {
  return str.replace(/'/g, "\\'");
}
