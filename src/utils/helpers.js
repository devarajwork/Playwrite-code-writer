// Utility helpers

export function generateId() {
  return 'step_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
  };

  toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Simple syntax highlighter for Playwright TypeScript code.
 * Returns HTML with <span> wrappers for syntax classes.
 */
export function highlightCode(code) {
  const lines = code.split('\n');
  return lines
    .map((line) => {
      let highlighted = escapeHtml(line);

      // Comments
      highlighted = highlighted.replace(
        /(\/\/.*)$/gm,
        '<span class="cmt">$1</span>'
      );

      // Strings (single-quoted)
      highlighted = highlighted.replace(
        /('(?:[^'\\]|\\.)*')/g,
        '<span class="str">$1</span>'
      );

      // Strings (backticks)
      highlighted = highlighted.replace(
        /(`(?:[^`\\]|\\.)*`)/g,
        '<span class="str">$1</span>'
      );

      // Keywords
      highlighted = highlighted.replace(
        /\b(import|from|export|const|let|var|async|await|function|return|if|else|new|throw|try|catch|finally|typeof|instanceof)\b/g,
        '<span class="kw">$1</span>'
      );

      // Playwright-specific: test, expect
      highlighted = highlighted.replace(
        /\b(test|expect|describe|beforeEach|afterEach|beforeAll|afterAll)\b/g,
        '<span class="type">$1</span>'
      );

      // Methods after dots: .click(), .fill(), etc.
      highlighted = highlighted.replace(
        /\.(goto|click|dblclick|fill|selectOption|check|uncheck|hover|press|waitFor|waitForSelector|screenshot|scrollIntoViewIfNeeded|toBeVisible|toContainText|toHaveValue|toHaveURL|getByRole|getByTestId|getByLabel|getByPlaceholder|getByText|locator|page)\b/g,
        '.<span class="prop">$1</span>'
      );

      // Braces / brackets
      highlighted = highlighted.replace(
        /([{}[\]()])/g,
        '<span class="br">$1</span>'
      );

      // Numbers
      highlighted = highlighted.replace(
        /\b(\d+)\b/g,
        '<span class="num">$1</span>'
      );

      return `<span class="code-line">${highlighted}</span>`;
    })
    .join('\n');
}

/**
 * Get the best selector from a scanned element's selector set.
 * Prioritizes: byTestId > byRole > byLabel > byPlaceholder > byId > byText > css
 */
export function getBestSelector(selectors) {
  if (selectors.byTestId) return selectors.byTestId;
  if (selectors.byId) return selectors.byId;
  if (selectors.byLabel) return selectors.byLabel;
  if (selectors.byPlaceholder) return selectors.byPlaceholder;
  if (selectors.byRole && selectors.byRole.includes('name:')) return selectors.byRole;
  if (selectors.byText) return selectors.byText;
  if (selectors.byRole) return selectors.byRole;
  if (selectors.css) {
    if (selectors.css.startsWith('page.')) return selectors.css;
    return `page.locator('${selectors.css}')`;
  }
  if (selectors.xpath) {
    if (selectors.xpath.startsWith('page.')) return selectors.xpath;
    return `page.locator('${selectors.xpath}')`;
  }
  return '';
}

/**
 * Step type display information
 */
export const STEP_TYPE_INFO = {
  navigate:        { emoji: '🌐', label: 'Navigate',        needsSelector: false, needsValue: true,  valuePlaceholder: 'https://web-dev.jugl.com/' },
  click:           { emoji: '👆', label: 'Click',            needsSelector: true,  needsValue: false, valuePlaceholder: '' },
  dblclick:        { emoji: '👆', label: 'Double Click',     needsSelector: true,  needsValue: false, valuePlaceholder: '' },
  fill:            { emoji: '✏️', label: 'Fill',             needsSelector: true,  needsValue: true,  valuePlaceholder: 'Text to type...' },
  select:          { emoji: '📋', label: 'Select',           needsSelector: true,  needsValue: true,  valuePlaceholder: 'Option value...' },
  check:           { emoji: '☑️', label: 'Check',            needsSelector: true,  needsValue: false, valuePlaceholder: '' },
  uncheck:         { emoji: '⬜', label: 'Uncheck',          needsSelector: true,  needsValue: false, valuePlaceholder: '' },
  hover:           { emoji: '🖱️', label: 'Hover',            needsSelector: true,  needsValue: false, valuePlaceholder: '' },
  press:           { emoji: '⌨️', label: 'Press Key',        needsSelector: true,  needsValue: true,  valuePlaceholder: 'Enter, Tab, Escape...' },
  scrollTo:        { emoji: '📜', label: 'Scroll To',        needsSelector: true,  needsValue: false, valuePlaceholder: '' },
  waitForSelector: { emoji: '⏳', label: 'Wait For',         needsSelector: true,  needsValue: true,  valuePlaceholder: 'Timeout in ms (optional)' },
  assertVisible:   { emoji: '👁️', label: 'Assert Visible',   needsSelector: true,  needsValue: false, valuePlaceholder: '' },
  assertText:      { emoji: '📝', label: 'Assert Text',      needsSelector: true,  needsValue: true,  valuePlaceholder: 'Expected text...' },
  assertValue:     { emoji: '🔢', label: 'Assert Value',     needsSelector: true,  needsValue: true,  valuePlaceholder: 'Expected value...' },
  assertUrl:       { emoji: '🔗', label: 'Assert URL',       needsSelector: false, needsValue: true,  valuePlaceholder: 'Expected URL or pattern...' },
  screenshot:      { emoji: '📸', label: 'Screenshot',       needsSelector: false, needsValue: true,  valuePlaceholder: 'filename.png' },
};
