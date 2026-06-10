(function() {
  function notifyParent(data) {
    if (typeof window.notifyBuilder === 'function') {
      window.notifyBuilder(data);
    } else {
      console.log("INSPECTOR_EVENT:" + JSON.stringify(data));
    }
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
    
    // Prioritize chained parent-scoped selectors (e.g. page.getByRole(...).getByRole(...))
    if (selectors.css && selectors.css.includes(').')) return selectors.css;
    
    if (selectors.byText) return selectors.byText;
    if (selectors.byTitle) return selectors.byTitle;
    if (selectors.byId) return selectors.byId;
    if (selectors.css) return selectors.css;
    if (selectors.byRole) return selectors.byRole; // Generic role like page.getByRole('button')
    return selectors.xpath || '';
  }

  function findInteractiveParent(el) {
    let current = el;
    for (let i = 0; i < 5; i++) {
      if (!current || current === document.body || current === document.documentElement) {
        break;
      }
      const tag = current.tagName.toLowerCase();
      if (tag === 'button' || tag === 'a' || current.getAttribute('role') === 'button' || current.getAttribute('role') === 'link' || current.classList.contains('btn') || current.classList.contains('button')) {
        return current;
      }
      const style = window.getComputedStyle(current);
      if (style.cursor === 'pointer' && (tag === 'div' || tag === 'span')) {
        return current;
      }
      current = current.parentElement;
    }
    return el;
  }

  function extractElementData(el, event) {
    const tagName = el.tagName.toLowerCase();
    const id = el.id || '';
    const name = el.getAttribute('name') || '';
    let value = '';
    const className = el.className && typeof el.className === 'string'
      ? el.className.split(' ').filter(c => c.length > 0 && !c.includes('pw-visual')).slice(0, 2).join(' ')
      : '';
    const text = (el.textContent || '').trim();
    const placeholder = el.getAttribute('placeholder') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const title = el.getAttribute('title') || '';
    const dataTestId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-cy') || '';
    const role = el.getAttribute('role') || '';
    const type = el.type || el.getAttribute('type') || '';

    // Find associated label text if it exists
    let labelText = ariaLabel;
    if (!labelText && id) {
      const labelEl = document.querySelector('label[for="' + id + '"]');
      if (labelEl) labelText = (labelEl.textContent || '').trim();
    }
    if (!labelText) {
      const parentLabel = el.closest('label');
      if (parentLabel) labelText = (parentLabel.textContent || '').replace(text, '').trim();
    }

    const selectors = {
      byTestId: dataTestId ? "page.getByTestId('" + dataTestId + "')" : "",
      byRole: "",
      byLabel: labelText ? "page.getByLabel('" + labelText.replace(/'/g, "\\\\'") + "')" : "",
      byPlaceholder: placeholder ? "page.getByPlaceholder('" + placeholder.replace(/'/g, "\\\\'") + "')" : "",
      byText: (text && text.length < 50) ? "page.getByText('" + text.replace(/'/g, "\\\\'") + "', { exact: true })" : "",
      byTitle: title ? "page.getByTitle('" + title.replace(/'/g, "\\\\'") + "')" : "",
      byId: id ? "page.locator('#" + id + "')" : "",
      css: "",
      xpath: ""
    };

    const implicitRoles = {
      button: 'button',
      a: 'link',
      input: type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : 'textbox',
      select: 'combobox',
      textarea: 'textbox',
      h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
      img: 'img',
      dialog: 'dialog',
      article: 'article',
      main: 'main',
      nav: 'navigation'
    };
    
    const effectiveRole = role || implicitRoles[tagName];
    if (effectiveRole) {
      const nameAttr = labelText || text.substring(0, 30);
      let roleOptions = "";
      if (nameAttr) {
        roleOptions = ", { name: '" + nameAttr.replace(/'/g, "\\\\'") + "'";
        if (tagName.match(/^h[1-6]$/)) {
          roleOptions += ", level: " + tagName.substring(1);
        }
        roleOptions += " }";
      } else if (tagName.match(/^h[1-6]$/)) {
        roleOptions = ", { level: " + tagName.substring(1) + " }";
      }
      
      selectors.byRole = "page.getByRole('" + effectiveRole + "'" + roleOptions + ")";
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
      css = tagName + '.' + className.split(' ').join('.');
    }
    selectors.css = "page.locator('" + css + "')";

    // Scoped CSS relative to identifiable parent if it lacks unique ID, data-testid, or name
    if (!id && !dataTestId && !name) {
      let parent = el.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const pId = parent.id;
        const pTestId = parent.getAttribute('data-testid') || parent.getAttribute('data-test-id') || parent.getAttribute('data-cy');
        const pText = (parent.textContent || '').trim();
        
        if (pTestId) {
          selectors.css = "page.locator('[data-testid=\"" + pTestId + "\"] " + css + "')";
          break;
        } else if (pId) {
          selectors.css = "page.locator('#" + pId + " " + css + "')";
          break;
        } else if (parent.tagName.toLowerCase() === 'button' && pText && pText.length < 50) {
          const escapedName = pText.replace(/'/g, "\\\\'");
          const childSelector = tagName === 'button' ? "getByRole('button')" : "locator('" + css + "')";
          selectors.css = "page.getByRole('button', { name: '" + escapedName + "' })." + childSelector;
          break;
        } else if (parent.getAttribute('role') === 'button' && pText && pText.length < 50) {
          const escapedName = pText.replace(/'/g, "\\\\'");
          const childSelector = tagName === 'button' ? "getByRole('button')" : "locator('" + css + "')";
          selectors.css = "page.getByRole('button', { name: '" + escapedName + "' })." + childSelector;
          break;
        } else if (pText && pText.length < 100 && pText !== text) {
          const firstLine = pText.split('\n')[0].trim();
          if (firstLine && firstLine.length < 50) {
            const escapedRegexText = firstLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "\\\\'");
            let childSelector = tagName === 'button' ? "getByRole('button')" : "locator('" + css + "')";
            
            // Check if multiple elements match the selector within the parent container
            const matches = parent.querySelectorAll(css);
            if (matches.length > 1) {
              const index = Array.from(matches).indexOf(el);
              if (index === 0) {
                childSelector += ".first()";
              } else if (index === matches.length - 1) {
                childSelector += ".last()";
              } else if (index !== -1) {
                childSelector += ".nth(" + index + ")";
              }
            }
            
            if ((tagName === 'svg' || tagName === 'rect' || tagName === 'path') && event) {
              const parentRect = parent.getBoundingClientRect();
              const offsetX = Math.round(event.clientX - parentRect.left);
              const offsetY = Math.round(event.clientY - parentRect.top);
              selectors.css = "page.locator('" + parent.tagName.toLowerCase() + "').filter({ hasText: /^" + escapedRegexText + "$/ }).first()";
              value = JSON.stringify({ position: { x: offsetX, y: offsetY } });
            } else {
              selectors.css = "page.locator('" + parent.tagName.toLowerCase() + "').filter({ hasText: /^" + escapedRegexText + "$/ })." + childSelector;
            }
            break;
          }
        }
        parent = parent.parentElement;
      }
    }

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
    return { tagName, id, bestSelector, text, placeholder, selectors, type, value };
  }

  function init() {
    injectStyles();

    // Inspect mouse movements
    document.addEventListener('mouseover', function(e) {
      let el = e.target;
      if (!el || el === document.body || el === document.documentElement || el.closest('.pw-visual-tooltip')) {
        return;
      }

      el = findInteractiveParent(el);

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

      el = findInteractiveParent(el);

      const elementData = extractElementData(el, e);

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
