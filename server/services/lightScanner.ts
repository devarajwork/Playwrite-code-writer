import * as cheerio from 'cheerio';
import type { ScannedElement, ScanResponse } from '../types.js';

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
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
].join(', ');

function buildSelectors(tagName: string, attrs: Record<string, string>, text: string) {
  const { id, name, placeholder, 'aria-label': ariaLabel, role, type } = attrs;
  const dataTestId =
    attrs['data-testid'] || attrs['data-test-id'] || attrs['data-cy'] || attrs['data-test'] || '';

  const selectors: Record<string, string> = {
    byTestId: '',
    byId: '',
    byRole: '',
    byLabel: '',
    byPlaceholder: '',
    byText: '',
    css: '',
    xpath: '',
  };

  if (dataTestId) selectors.byTestId = `page.getByTestId('${dataTestId}')`;
  if (id) selectors.byId = `page.locator('#${id}')`;

  if (ariaLabel) {
    selectors.byLabel = `page.getByLabel('${ariaLabel.replace(/'/g, "\\'")}')`;
  }
  if (placeholder) {
    selectors.byPlaceholder = `page.getByPlaceholder('${placeholder.replace(/'/g, "\\'")}')`;
  }
  if (text && text.length < 60) {
    selectors.byText = `page.getByText('${text.replace(/'/g, "\\'")}', { exact: true })`;
  }

  const implicitRoles: Record<string, string> = {
    button: 'button',
    a: 'link',
    input: type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : 'textbox',
    select: 'combobox',
    textarea: 'textbox',
    h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
  };
  const effectiveRole = role || implicitRoles[tagName] || '';
  if (effectiveRole) {
    const nameAttr = ariaLabel || text.substring(0, 50);
    selectors.byRole = nameAttr
      ? `page.getByRole('${effectiveRole}', { name: '${nameAttr.replace(/'/g, "\\'")}' })`
      : `page.getByRole('${effectiveRole}')`;
  }

  let css = tagName;
  if (id) css = `#${id}`;
  else if (name) css = `${tagName}[name="${name}"]`;
  else if (dataTestId) css = `[data-testid="${dataTestId}"]`;
  selectors.css = `page.locator('${css}')`;

  let xpath = `//${tagName}`;
  if (id) xpath = `//*[@id="${id}"]`;
  else if (dataTestId) xpath = `//*[@data-testid="${dataTestId}"]`;
  else if (name) xpath = `//${tagName}[@name="${name}"]`;
  else if (text && text.length < 40) xpath = `//${tagName}[contains(text(),"${text.substring(0, 30)}")]`;
  selectors.xpath = `page.locator('${xpath}')`;

  return { selectors, effectiveRole, dataTestId };
}

export async function scanUrlLightweight(url: string): Promise<ScanResponse> {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();

  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  const elements: ScannedElement[] = [];
  const seen = new Set<string>();

  $(interactiveSelectors).each((_i, el) => {
    const $el = $(el);
    const tagName = el.type === 'tag' ? (el.name || '').toLowerCase() : '';
    if (!tagName) return;

    // Gather attributes
    const element = el as any;
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(element.attribs || {})) {
      attrs[k] = String(v ?? '');
    }

    const id = attrs['id'] || '';
    const name = attrs['name'] || '';
    const rawText = ($el.text() || '').trim();
    const text = rawText.length > 80 ? rawText.substring(0, 80) + '…' : rawText;
    const placeholder = attrs['placeholder'] || '';
    const ariaLabel = attrs['aria-label'] || '';
    const href = attrs['href'] || '';
    const type = attrs['type'] || '';
    const className = (attrs['class'] || '')
      .split(' ')
      .filter((c) => c.length > 0 && c.length < 60)
      .slice(0, 3)
      .join(' ');
    const dataTestId =
      attrs['data-testid'] || attrs['data-test-id'] || attrs['data-cy'] || attrs['data-test'] || '';

    // Dedup by a rough fingerprint
    const fingerprint = `${tagName}|${id}|${name}|${text.substring(0, 30)}`;
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);

    const { selectors, effectiveRole } = buildSelectors(tagName, attrs, text);

    elements.push({
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
      selectors: selectors as any,
    });
  });

  return {
    url,
    title,
    elementCount: elements.length,
    elements,
    timestamp: new Date().toISOString(),
    note:
      elements.length < 5
        ? 'This page likely uses JavaScript (SPA/React). Element count may be low. Use the Visual Inspector for accurate results.'
        : undefined,
  } as ScanResponse;
}
