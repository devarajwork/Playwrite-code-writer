import { Router } from 'express';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const router = Router();

let inspectorBrowser: Browser | null = null;
let inspectorContext: BrowserContext | null = null;
let sseClients: any[] = [];

function broadcast(data: any) {
  sseClients.forEach(client => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseClients.push(res);
  
  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

const INJECT_SCRIPT = `
(function() {
  function notifyParent(data) {
    console.log("NOTIFYING BUILDER:", data);
    if (window.notifyBuilder) {
      window.notifyBuilder(data).catch(e => console.error("Builder notify error:", e));
    } else {
      console.error("window.notifyBuilder is not defined!");
    }
  }

  // Inject styles for highlight
  const style = document.createElement('style');
  style.textContent = \`
    .pw-visual-highlight {
      outline: 2px solid #8b5cf6 !important;
      outline-offset: -2px !important;
      background: rgba(139, 92, 246, 0.1) !important;
      transition: all 0.1s ease !important;
      cursor: crosshair !important;
    }
    .pw-visual-tooltip {
      position: absolute !important;
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
  \`;
  document.head.appendChild(style);

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
    if (selectors.byId) return selectors.byId;
    if (selectors.byLabel) return selectors.byLabel;
    if (selectors.byPlaceholder) return selectors.byPlaceholder;
    if (selectors.byRole && selectors.byRole.includes('name:')) return selectors.byRole;
    if (selectors.byText) return selectors.byText;
    if (selectors.byRole) return selectors.byRole;
    return selectors.css || '';
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

  // Inspect mouse movements
  document.addEventListener('mouseover', function(e) {
    const el = e.target;
    if (!el || el === document.body || el === document.documentElement || el.closest('.pw-visual-tooltip')) {
      return;
    }

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
    let top = rect.bottom + window.scrollY + 8;
    if (rect.bottom + 50 > window.innerHeight) {
      top = rect.top + window.scrollY - 32;
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
    const el = e.target;
    if (!el || el === document.body || el === document.documentElement) return;

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

})();
`;

router.post('/start', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  try {
    if (inspectorBrowser) {
      await inspectorBrowser.close();
    }
    
    // Launch headful browser
    try {
      inspectorBrowser = await chromium.launch({ headless: false });
    } catch {
      inspectorBrowser = await chromium.launch({ headless: false, channel: 'chrome' });
    }
    
    inspectorContext = await inspectorBrowser.newContext({
      viewport: null, // Let the window size determine viewport
    });
    
    // Expose binding to send events back to Node
    await inspectorContext.exposeFunction('notifyBuilder', (data: any) => {
      console.log('Inspector Event Received:', data.type, data.element?.tagName);
      broadcast(data);
    });

    // Add init script
    await inspectorContext.addInitScript(`
      ${INJECT_SCRIPT}
    `);

    const page = await inspectorContext.newPage();
    
    page.on('close', () => {
      broadcast({ type: 'BROWSER_CLOSED' });
    });

    await page.goto(url);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Inspector launch error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/stop', async (req, res) => {
  if (inspectorBrowser) {
    try {
      await inspectorBrowser.close();
    } catch (e) {}
    inspectorBrowser = null;
    inspectorContext = null;
  }
  res.json({ success: true });
});

export default router;
