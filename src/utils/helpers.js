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
        /\.(goto|click|dblclick|fill|pressSequentially|selectOption|check|uncheck|hover|press|waitFor|waitForSelector|screenshot|scrollIntoViewIfNeeded|toBeVisible|toContainText|toHaveValue|toHaveURL|getByRole|getByTestId|getByLabel|getByPlaceholder|getByText|locator|page)\b/g,
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
  if (selectors.byLabel) return selectors.byLabel;
  if (selectors.byPlaceholder) return selectors.byPlaceholder;
  if (selectors.byRole && selectors.byRole.includes('name:')) return selectors.byRole;
  
  // Prioritize chained parent-scoped selectors (e.g. page.getByRole(...).getByRole(...))
  if (selectors.css && selectors.css.includes(').')) {
    if (selectors.css.startsWith('page.')) return selectors.css;
    return `page.locator('${selectors.css}')`;
  }
  
  if (selectors.byId) return selectors.byId;
  if (selectors.byText) return selectors.byText;
  
  if (selectors.css) {
    if (selectors.css.startsWith('page.')) return selectors.css;
    return `page.locator('${selectors.css}')`;
  }
  if (selectors.byRole) return selectors.byRole; // Generic role like page.getByRole('button')
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
  upload:          { emoji: '📁', label: 'Upload File',      needsSelector: true,  needsValue: true,  valuePlaceholder: 'path/to/file.pdf' },
  hover:           { emoji: '🖱️', label: 'Hover',            needsSelector: true,  needsValue: false, valuePlaceholder: '' },
  press:           { emoji: '⌨️', label: 'Press Key',        needsSelector: true,  needsValue: true,  valuePlaceholder: 'Enter, Tab, Escape...' },
  scrollTo:        { emoji: '📜', label: 'Scroll To',        needsSelector: true,  needsValue: false, valuePlaceholder: '' },
  waitForSelector: { emoji: '⏳', label: 'Wait For',         needsSelector: true,  needsValue: true,  valuePlaceholder: 'Timeout in ms (optional)' },
  waitForTimeout:  { emoji: '⏱️', label: 'Wait (Time)',      needsSelector: false, needsValue: true,  valuePlaceholder: 'Timeout in ms (e.g. 2000)' },
  assertVisible:   { emoji: '👁️', label: 'Assert Visible',   needsSelector: true,  needsValue: false, valuePlaceholder: '' },
  assertText:      { emoji: '📝', label: 'Assert Text',      needsSelector: true,  needsValue: true,  valuePlaceholder: 'Expected text...' },
  assertValue:     { emoji: '🔢', label: 'Assert Value',     needsSelector: true,  needsValue: true,  valuePlaceholder: 'Expected value...' },
  assertUrl:       { emoji: '🔗', label: 'Assert URL',       needsSelector: false, needsValue: true,  valuePlaceholder: 'Expected URL or pattern...' },
  screenshot:      { emoji: '📸', label: 'Screenshot',       needsSelector: false, needsValue: true,  valuePlaceholder: 'filename.png' },
};

/**
 * Parse Playwright TypeScript code back into a list of TestStep objects.
 */
export function parsePlaywrightScript(code) {
  const steps = [];
  let testName = 'Imported Test';
  let tags = '';
  
  const nameMatch = code.match(/test\(\s*['"`](.*?)['"`]/);
  if (nameMatch) {
    let parsedName = nameMatch[1];
    const tagsMatch = parsedName.match(/(@[\w-]+)/g);
    if (tagsMatch) {
      testName = parsedName.replace(/(@[\w-]+)/g, '').trim();
      tags = tagsMatch.join(' ');
    } else {
      testName = parsedName;
    }
  }

  // Extremely robust body extraction: just find the async page block and the last closing brace
  const bodyStartMatch = code.match(/async\s*\(\s*\{[^}]*page[^}]*\}\s*\)\s*=>\s*\{/);
  if (!bodyStartMatch) return { testName, tags, steps };
  
  const startIdx = bodyStartMatch.index + bodyStartMatch[0].length;
  let endIdx = code.lastIndexOf('});');
  if (endIdx === -1 || endIdx < startIdx) {
    endIdx = code.lastIndexOf('})');
  }
  if (endIdx === -1 || endIdx < startIdx) {
    endIdx = code.length; // fallback
  }
  
  const body = code.substring(startIdx, endIdx);
  const lines = body.split('\n');
  
  let currentDescription = '';
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    
    let disabled = false;
    if (line.startsWith('// [Disabled] ')) {
      disabled = true;
      line = line.substring(14).trim();
    }
    
    if (line.startsWith('//')) {
      currentDescription = line.substring(2).trim();
      continue;
    }
    
    let type = '';
    let selector = '';
    let value = '';
    let waitUntil = '';
    let delay = undefined;
    
    if (line.includes('page.goto(')) {
      type = 'navigate';
      const m = line.match(/goto\(['"`](.*?)['"`]/);
      if (m) value = m[1];
      const wm = line.match(/waitUntil:\s*['"`](.*?)['"`]/);
      if (wm) waitUntil = wm[1];
    } 
    else if (line.includes('.click(')) {
      type = 'click';
      selector = extractLocator(line);
    }
    else if (line.includes('.dblclick(')) {
      type = 'dblclick';
      selector = extractLocator(line);
    }
    else if (line.includes('.fill(')) {
      type = 'fill';
      selector = extractLocator(line);
      const m = line.match(/\.fill\(['"`](.*?)['"`]\)/);
      if (m) value = m[1];
    }
    else if (line.includes('.pressSequentially(')) {
      type = 'fill';
      selector = extractLocator(line);
      const m = line.match(/\.pressSequentially\(['"`](.*?)['"`]/);
      if (m) value = m[1];
      const dm = line.match(/delay:\s*(\d+)/);
      if (dm) delay = parseInt(dm[1], 10);
    }
    else if (line.includes('.selectOption(')) {
      type = 'select';
      selector = extractLocator(line);
      const m = line.match(/\.selectOption\(['"`](.*?)['"`]\)/);
      if (m) value = m[1];
    }
    else if (line.includes('.check(')) {
      type = 'check';
      selector = extractLocator(line);
    }
    else if (line.includes('.uncheck(')) {
      type = 'uncheck';
      selector = extractLocator(line);
    } else if (line.includes('.hover(')) {
      type = 'hover';
      const m = line.match(/await\s+(.*?)\.hover\(\)/);
      if (m) {
        selector = m[1];
      } else {
        selector = extractLocator(line);
      }
    } else if (line.includes('.setInputFiles(')) {
      type = 'upload';
      const m = line.match(/await\s+(.*?)\.setInputFiles\(['"`](.*?)['"`]\)/);
      if (m) {
        selector = m[1];
        value = m[2];
      }
    } else if (line.includes('.press(')) {
      type = 'press';
      selector = extractLocator(line);
      const m = line.match(/\.press\(['"`](.*?)['"`]\)/);
      if (m) value = m[1];
    }
    else if (line.includes('.scrollIntoViewIfNeeded(')) {
      type = 'scrollTo';
      selector = extractLocator(line);
    }
    else if (line.includes('expect(') && line.includes('.toBeVisible()')) {
      type = 'assertVisible';
      selector = extractLocatorFromExpect(line);
    }
    else if (line.includes('expect(') && line.includes('.toContainText(')) {
      type = 'assertText';
      selector = extractLocatorFromExpect(line);
      const m = line.match(/\.toContainText\(['"`](.*?)['"`]\)/);
      if (m) value = m[1];
    }
    else if (line.includes('expect(') && line.includes('.toHaveValue(')) {
      type = 'assertValue';
      selector = extractLocatorFromExpect(line);
      const m = line.match(/\.toHaveValue\(['"`](.*?)['"`]\)/);
      if (m) value = m[1];
    }
    else if (line.includes('expect(page).toHaveURL(')) {
      type = 'assertUrl';
      const m = line.match(/\.toHaveURL\((?:['"`\/](.*?)['"`\/])\)/);
      if (m) value = m[1];
    }
    else if (line.includes('page.waitForSelector(')) {
      type = 'waitForSelector';
      const m = line.match(/waitForSelector\(['"`](.*?)['"`]/);
      if (m) selector = m[1];
      const tm = line.match(/timeout:\s*(\d+)/);
      if (tm) value = tm[1];
    }
    else if (line.includes('page.waitForTimeout(')) {
      type = 'waitForTimeout';
      const m = line.match(/waitForTimeout\(\s*(\d+)\s*\)/);
      if (m) value = m[1];
    }
    else if (line.includes('.waitFor({')) {
      type = 'waitForSelector';
      selector = extractLocator(line);
      const tm = line.match(/timeout:\s*(\d+)/);
      if (tm) value = tm[1];
    }
    else if (line.includes('page.screenshot(')) {
      type = 'screenshot';
      const m = line.match(/path:\s*['"`](.*?)['"`]/);
      if (m) value = m[1];
    }
    
    if (type) {
      steps.push({
        id: generateId(),
        type,
        selector,
        value,
        waitUntil,
        delay,
        description: currentDescription,
        disabled,
        order: steps.length
      });
      currentDescription = '';
    }
  }
  return { testName, tags, steps };
}

function extractLocator(line) {
  // Use greedy .* up to the action method call to handle nested parentheses
  const m = line.match(/(page\.(?:locator|getByTestId|getByRole|getByLabel|getByPlaceholder|getByText)\(.*\))(?=\.(?:click|dblclick|fill|pressSequentially|selectOption|check|uncheck|hover|press|scrollIntoViewIfNeeded|waitFor|setInputFiles))/);
  return m ? m[1] : '';
}

function extractLocatorFromExpect(line) {
  // Use greedy .* up to the closing parenthesis of expect()
  const m = line.match(/expect\((page\.(?:locator|getByTestId|getByRole|getByLabel|getByPlaceholder|getByText)\(.*\))\)/);
  return m ? m[1] : '';
}

export function customConfirm(message, title = 'Confirm') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '9999';

    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const header = document.createElement('div');
    header.className = 'modal__header';
    header.innerHTML = `<h3 class="modal__title">${escapeHtml(title)}</h3>`;
    
    const body = document.createElement('div');
    body.className = 'modal__body';
    body.innerHTML = `<p>${escapeHtml(message)}</p>`;
    
    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = 'Cancel';
    
    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn--primary';
    okBtn.textContent = 'OK';
    
    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    okBtn.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });
  });
}

export function customPrompt(message, defaultValue = '', title = 'Input Required') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '9999';

    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const header = document.createElement('div');
    header.className = 'modal__header';
    header.innerHTML = `<h3 class="modal__title">${escapeHtml(title)}</h3>`;
    
    const body = document.createElement('div');
    body.className = 'modal__body';
    
    const msgEl = document.createElement('p');
    msgEl.style.marginBottom = 'var(--space-3)';
    msgEl.textContent = message;
    
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'form-input';
    inputEl.value = defaultValue;
    
    body.appendChild(msgEl);
    body.appendChild(inputEl);
    
    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = 'Cancel';
    
    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn--primary';
    okBtn.textContent = 'OK';
    
    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    inputEl.focus();

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    okBtn.addEventListener('click', () => {
      cleanup();
      resolve(inputEl.value);
    });
    
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        cleanup();
        resolve(inputEl.value);
      }
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    });
  });
}
