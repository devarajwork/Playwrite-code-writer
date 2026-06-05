import { chromium, type Page } from 'playwright';
import type { ScannedElement, SelectorSet, ScanResponse } from '../types.js';

export async function scanUrl(url: string): Promise<ScanResponse> {
  // Docker/Linux requires --no-sandbox and --disable-dev-shm-usage
  const launchArgs = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-setuid-sandbox',
  ];

  const browser = await chromium.launch({ headless: true, args: launchArgs });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait a bit for dynamic content to load (SPAs like React)
    await page.waitForTimeout(2000);

    const title = await page.title();

    const elements = await extractElements(page);

    return {
      url,
      title,
      elementCount: elements.length,
      elements,
      timestamp: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}

async function extractElements(page: Page): Promise<ScannedElement[]> {
  return await page.evaluate(() => {
    const interactiveSelectors = [
      'button',
      'input',
      'select',
      'textarea',
      'a[href]',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="switch"]',
      '[role="combobox"]',
      '[role="textbox"]',
      '[role="search"]',
      '[data-testid]',
      '[data-test-id]',
      '[data-cy]',
      '[data-test]',
      'label',
      '[contenteditable="true"]',
      '[tabindex]',
      'summary',
      'details',
      'dialog',
      'form',
      'img[alt]',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ];

    const allElements = document.querySelectorAll(interactiveSelectors.join(', '));
    const results: any[] = [];
    const seen = new Set<Element>();

    allElements.forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);

      // Skip hidden/invisible elements
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if ((el as HTMLElement).offsetParent === null && style.position !== 'fixed') return;

      const tagName = el.tagName.toLowerCase();
      const id = el.id || '';
      const name = el.getAttribute('name') || '';
      const className = el.className && typeof el.className === 'string'
        ? el.className.split(' ').filter(c => c.length > 0 && c.length < 60).slice(0, 3).join(' ')
        : '';
      const dataTestId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-cy') || el.getAttribute('data-test') || '';
      const role = el.getAttribute('role') || '';
      const type = el.getAttribute('type') || '';
      const placeholder = el.getAttribute('placeholder') || '';
      const rawText = (el.textContent || '').trim();
      const text = rawText.length > 80 ? rawText.substring(0, 80) + '…' : rawText;
      const ariaLabel = el.getAttribute('aria-label') || '';
      const href = el.getAttribute('href') || '';

      // Build selectors
      const selectors: any = {
        byTestId: '',
        byRole: '',
        byLabel: '',
        byPlaceholder: '',
        byText: '',
        css: '',
        xpath: '',
        byId: '',
      };

      // data-testid selector
      if (dataTestId) {
        selectors.byTestId = `page.getByTestId('${dataTestId}')`;
      }

      // ID selector
      if (id) {
        selectors.byId = `page.locator('#${id}')`;
      }

      // Role selector
      const implicitRoles: Record<string, string> = {
        button: 'button',
        a: 'link',
        input: type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : 'textbox',
        select: 'combobox',
        textarea: 'textbox',
        h1: 'heading',
        h2: 'heading',
        h3: 'heading',
        h4: 'heading',
        h5: 'heading',
        h6: 'heading',
        img: 'img',
        dialog: 'dialog',
        form: 'form',
        summary: 'button',
      };

      const effectiveRole = role || implicitRoles[tagName] || '';
      if (effectiveRole) {
        const nameAttr = ariaLabel || text.substring(0, 50) || '';
        if (nameAttr) {
          selectors.byRole = `page.getByRole('${effectiveRole}', { name: '${nameAttr.replace(/'/g, "\\'")}' })`;
        } else {
          selectors.byRole = `page.getByRole('${effectiveRole}')`;
        }
      }

      // Label selector
      if (ariaLabel) {
        selectors.byLabel = `page.getByLabel('${ariaLabel.replace(/'/g, "\\'")}')`;
      } else if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        // Try to find associated label
        const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
        if (labelEl) {
          const labelText = (labelEl.textContent || '').trim();
          if (labelText) {
            selectors.byLabel = `page.getByLabel('${labelText.replace(/'/g, "\\'")}')`;
          }
        }
      }

      // Placeholder selector
      if (placeholder) {
        selectors.byPlaceholder = `page.getByPlaceholder('${placeholder.replace(/'/g, "\\'")}')`;
      }

      // Text selector
      if (text && text.length < 60) {
        selectors.byText = `page.getByText('${text.replace(/'/g, "\\'")}', { exact: true })`;
      }

      // CSS selector fallback
      let css = tagName;
      if (id) {
        css = `#${id}`;
      } else if (name) {
        css = `${tagName}[name="${name}"]`;
      } else if (dataTestId) {
        css = `[data-testid="${dataTestId}"]`;
      } else if (className) {
        css = `${tagName}.${className.split(' ')[0]}`;
      }
      selectors.css = `page.locator('${css}')`;

      // XPath
      let xpath = `//${tagName}`;
      if (id) {
        xpath = `//*[@id="${id}"]`;
      } else if (dataTestId) {
        xpath = `//*[@data-testid="${dataTestId}"]`;
      } else if (name) {
        xpath = `//${tagName}[@name="${name}"]`;
      } else if (text && text.length < 40) {
        xpath = `//${tagName}[contains(text(),"${text.substring(0, 30).replace(/'/g, "\\'")}")]`;
      }
      selectors.xpath = `page.locator('${xpath}')`;

      results.push({
        tagName,
        id,
        name,
        className,
        dataTestId,
        role: effectiveRole,
        type,
        placeholder,
        text,
        ariaLabel,
        href,
        selectors,
      });
    });

    return results;
  });
}
