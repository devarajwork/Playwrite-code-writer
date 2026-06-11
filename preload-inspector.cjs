const { ipcRenderer } = require('electron');

(function() {
  function notifyParent(data) {
    console.log("Webview notifying host:", data);
    ipcRenderer.sendToHost('webview-event', data);
  }

  function injectStyles() {
    if (document.getElementById('pw-visual-inspector-styles')) return;
    const style = document.createElement('style');
    style.id = 'pw-visual-inspector-styles';
    style.textContent = `
      .pw-visual-highlight {
        outline: 2px solid #8b5cf6 !important;
        outline-offset: -2px !important;
        background: rgba(139, 92, 246, 0.1) !important;
        transition: all 0.1s ease !important;
        cursor: crosshair !important;
      }
      .pw-visual-tooltip {
        position: fixed !important;
        background: rgba(30, 30, 46, 0.95) !important;
        backdrop-filter: blur(4px) !important;
        color: #f8fafc !important;
        padding: 6px 10px !important;
        border-radius: 8px !important;
        font-family: 'Inter', sans-serif !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        border: 1px solid rgba(99, 115, 164, 0.3) !important;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.5) !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }
    `;
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.documentElement.appendChild(style);
    }
  }

  let tooltip = null;
  let activeElement = null;

  function createTooltip() {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.className = 'pw-visual-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
  }

  function getBestSelector(selectors) {
    if (selectors.byTestId) return selectors.byTestId;
    if (selectors.byRole && selectors.byRole.includes('name:')) return selectors.byRole;
    if (selectors.byLabel) return selectors.byLabel;
    if (selectors.byPlaceholder) return selectors.byPlaceholder;
    if (selectors.byText) return selectors.byText;
    if (selectors.byRole) return selectors.byRole;
    if (selectors.byId) return selectors.byId;
    return selectors.css || '';
  }

  function getInteractiveElement(el) {
    const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      const tagName = current.tagName.toLowerCase();
      const role = current.getAttribute('role');
      if (interactiveTags.includes(tagName) || role === 'button' || role === 'link' || role === 'checkbox' || role === 'menuitem') {
        return current;
      }
      current = current.parentElement;
    }
    return el;
  }

  function extractElementData(el) {
    const tagName = el.tagName.toLowerCase();
    const id = el.id || '';
    const name = el.getAttribute('name') || '';
    const className = el.className && typeof el.className === 'string'
      ? el.className.split(' ').filter(c => c.length > 0 && !c.includes('pw-visual')).slice(0, 2).join(' ')
      : '';
    const text = (el.textContent || '').trim();
    const placeholder = el.getAttribute('placeholder') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const dataTestId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-cy') || '';
    const role = el.getAttribute('role') || '';
    const type = el.type || el.getAttribute('type') || '';

    // Construct selectors matching codeGenerator logic
    const selectors = {
      byTestId: dataTestId ? "page.getByTestId('" + dataTestId + "')" : "",
      byId: id ? "page.locator('#" + id + "')" : "",
      byRole: "",
      byLabel: ariaLabel ? "page.getByLabel('" + ariaLabel.replace(/'/g, "\\\\'") + "')" : "",
      byPlaceholder: placeholder ? "page.getByPlaceholder('" + placeholder.replace(/'/g, "\\\\'") + "')" : "",
      byText: (text && text.length < 50) ? "page.getByText('" + text.replace(/'/g, "\\\\'") + "', { exact: true })" : "",
      css: "",
      xpath: ""
    };

    const implicitRoles = {
      button: 'button',
      a: 'link',
      input: type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : 'textbox',
      select: 'combobox',
      textarea: 'textbox'
    };
    const effectiveRole = role || implicitRoles[tagName];
    if (effectiveRole) {
      const nameAttr = ariaLabel || text.substring(0, 30);
      if (nameAttr) {
        selectors.byRole = "page.getByRole('" + effectiveRole + "', { name: '" + nameAttr.replace(/'/g, "\\\\'") + "' })";
      } else {
        selectors.byRole = "page.getByRole('" + effectiveRole + "')";
      }
    }

    // Build CSS locator statement
    let css = tagName;
    if (id) {
      css = '#' + id;
    } else if (name) {
      css = tagName + '[name="' + name + '"]';
    } else if (dataTestId) {
      css = '[data-testid="' + dataTestId + '"]';
    } else if (className) {
      css = tagName + '.' + className.split(' ')[0];
    }
    selectors.css = "page.locator('" + css + "')";

    // Build XPath locator statement
    let xpath = '//' + tagName;
    if (id) {
      xpath = '//*[@id="' + id + '"]';
    } else if (dataTestId) {
      xpath = '//*[@data-testid="' + dataTestId + '"]';
    } else if (name) {
      xpath = '//' + tagName + '[@name="' + name + '"]';
    } else if (text && text.length < 40) {
      xpath = '//' + tagName + '[contains(text(),"' + text.substring(0, 30).replace(/'/g, "\\\\'") + '")]';
    }
    selectors.xpath = "page.locator('" + xpath + "')";

    const bestSelector = getBestSelector(selectors);
    return { tagName, id, bestSelector, text, placeholder, selectors, type };
  }

  function init() {
    injectStyles();

    // Inspect mouse movements
    document.addEventListener('mouseover', function(e) {
      let el = e.target;
      if (!el || el === document.body || el === document.documentElement || el.closest('.pw-visual-tooltip')) {
        return;
      }
      
      el = getInteractiveElement(el);

      if (activeElement) {
        activeElement.classList.remove('pw-visual-highlight');
      }

      activeElement = el;
      el.classList.add('pw-visual-highlight');

      // Update and position tooltip
      createTooltip();
      const tagName = el.tagName.toLowerCase();
      const idText = el.id ? '#' + el.id : '';
      const textSnippet = (el.textContent || '').trim().substring(0, 15);
      tooltip.innerHTML = '<span style="color: #a78bfa">&lt;' + tagName + idText + '&gt;</span>' + (textSnippet ? ' • "' + textSnippet + '"' : '');
      tooltip.style.display = 'flex';

      const rect = el.getBoundingClientRect();
      let left = rect.left;
      if (left + 200 > window.innerWidth) {
        left = window.innerWidth - 220;
      }
      let top = rect.bottom + 8;
      if (rect.bottom + 50 > window.innerHeight) {
        top = rect.top - 32;
      }

      tooltip.style.left = Math.max(8, left) + 'px';
      tooltip.style.top = Math.max(8, top) + 'px';
    }, true);

    document.addEventListener('mouseout', function(e) {
      if (activeElement === e.target) {
        e.target.classList.remove('pw-visual-highlight');
        activeElement = null;
      }
      if (tooltip) {
        tooltip.style.display = 'none';
      }
    }, true);

    // Catch clicks naturally
    document.addEventListener('click', function(e) {
      let el = e.target;
      if (!el || el === document.body || el === document.documentElement) return;
      
      el = getInteractiveElement(el);

      const elementData = extractElementData(el);

      notifyParent({
        type: 'ELEMENT_CLICKED',
        element: elementData
      });
    }, true);

    // Catch input/select updates on blur/change
    ['blur', 'change'].forEach(function(eventType) {
      document.addEventListener(eventType, function(e) {
        const el = e.target;
        if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT')) return;

        const value = el.value;
        if (!value && el.type !== 'file') return;

        const elementData = extractElementData(el);
        notifyParent({
          type: 'INPUT_CHANGED',
          element: {
            ...elementData,
            value: value
          }
        });
      }, true);
    });

    // Periodically track URL changes
    let lastUrl = window.location.href;
    setInterval(function() {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        notifyParent({
          type: 'URL_CHANGED',
          url: lastUrl
        });
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
