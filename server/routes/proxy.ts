import { Router } from 'express';
import { chromium } from 'playwright';

const router = Router();

function cleanAndProxyHTML(html: string, originalUrl: string): string {
  const targetOrigin = new URL(originalUrl).origin;

  // 1. Strip Content Security Policy meta tags
  html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

  // 2. Rewrite relative <a> href anchors to point to our proxy HTML loader
  html = html.replace(/(<a\s+[^>]*href=["'])([^"']*)(["'])/gi, (match, p1, href, p3) => {
    if (href.startsWith('javascript:') || href.startsWith('#') || href.startsWith('data:') || href.includes('/api/proxy?url=')) {
      return match;
    }
    try {
      const resolvedUrl = new URL(href, originalUrl).href;
      return `${p1}/api/proxy?url=${encodeURIComponent(resolvedUrl)}${p3}`;
    } catch {
      return match;
    }
  });

  // 3. Rewrite relative src/href/data-src/poster attributes starting with '/' (stylesheets, scripts, images)
  html = html.replace(/(src|href|data-src|poster)=["']\/([^"']*)["']/gi, (match, attr, path) => {
    if (path.startsWith('api/proxy') || path.startsWith('http')) {
      return match;
    }
    return `${attr}="/api/proxy/${path}"`;
  });

  // 3b. Rewrite srcset attributes
  html = html.replace(/srcset=["']([^"']*)["']/gi, (match, content) => {
    // split by comma, then find URLs starting with /
    const parts = content.split(',').map((part: string) => {
      const trimmed = part.trim();
      if (trimmed.startsWith('/') && !trimmed.startsWith('/api/proxy')) {
        return part.replace(/(^\s*)\//, '$1/api/proxy/');
      }
      return part;
    });
    return `srcset="${parts.join(',')}"`;
  });

  // 3c. Rewrite inline CSS url('/...')
  html = html.replace(/url\(['"]?\/([^'"\)]*)['"]?\)/gi, (match, path) => {
    if (path.startsWith('api/proxy') || path.startsWith('http') || path.startsWith('data:')) {
      return match;
    }
    return `url('/api/proxy/${path}')`;
  });

  // 4. Rewrite absolute target URLs in src/href to point to local proxy paths
  const escapedOrigin = targetOrigin.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const absoluteRegex = new RegExp(`(src|href|data-src|poster)=["']${escapedOrigin}(/[^"']*)["']`, 'gi');
  html = html.replace(absoluteRegex, (match, attr, path) => {
    if (attr.toLowerCase() === 'href' && match.toLowerCase().includes('<a')) {
      return `href="/api/proxy?url=${encodeURIComponent(targetOrigin + path)}"`;
    }
    return `${attr}="/api/proxy${path}"`;
  });

  return html;
}

// Sub-route to proxy external API requests dynamically to bypass CORS
router.all('/request', async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send('URL query parameter is required');
    return;
  }

  try {
    const targetOrigin = new URL(targetUrl).origin;
    
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    headers['host'] = new URL(targetOrigin).host;
    // Set referer and origin to target expectations so the external API doesn't reject them
    headers['referer'] = targetOrigin + '/';
    headers['origin'] = targetOrigin;
    
    // Remove headers handled directly by node fetch to prevent body size mismatch
    delete headers['content-length'];
    delete headers['connection'];
    delete headers['accept-encoding'];

    let bodyInit: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      bodyInit = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: bodyInit,
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key !== 'content-encoding' && key !== 'access-control-allow-origin' && key !== 'content-security-policy') {
        res.setHeader(key, value);
      }
    });

    const body = await response.arrayBuffer();
    res.send(Buffer.from(body));
  } catch (err: any) {
    console.error(`⚠️ Request proxy error for ${targetUrl}:`, err.message);
    res.status(500).send(`Failed to proxy request: ${err.message}. Stack: ${err.stack}`);
  }
});

router.get('/', async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).send('URL query parameter is required');
    return;
  }

  console.log(`🌐 Proxying website for live visual selector: ${url}`);
  
  let isResponded = false;
  const hardTimeout = setTimeout(() => {
    if (!isResponded) {
      isResponded = true;
      console.error('Proxy hard timeout reached (25s)!');
      res.status(504).send('Gateway Timeout: The proxy took too long to load the page.');
    }
  }, 25000);

  let browser;
  try {
    console.log('Launching Playwright browser...');
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ headless: true, channel: 'chrome' });
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    console.log('Navigating to URL...');
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      // Wait a brief moment for async elements
      await page.waitForTimeout(2000);
    } catch (e) {
      console.warn(`Timeout waiting for ${url} to finish loading. Proceeding with captured content.`);
    }

    console.log('Extracting HTML content...');
    let html = await page.content();
    const actualUrl = page.url();
    
    console.log('Cleaning and proxying HTML...');
    // Clean, normalise, and proxy relative paths in HTML
    html = cleanAndProxyHTML(html, actualUrl);

    // Set cookie for target origin so subsequent asset requests know where to go
    const targetOrigin = new URL(actualUrl).origin;
    res.setHeader('Set-Cookie', `proxy_target_origin=${encodeURIComponent(targetOrigin)}; Path=/; SameSite=Lax`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Set base tag to our local proxy endpoint so relative scripts and styles resolve to localhost
    const baseTag = '<base href="/api/proxy/">';
    const injection = `
      ${baseTag}
      <style>
        /* Highlight elements on hover */
        .pw-visual-highlight {
          outline: 2px dashed #8b5cf6 !important;
          outline-offset: -2px !important;
          cursor: pointer !important;
          transition: outline-color 0.15s ease !important;
        }
        .pw-visual-highlight:hover {
          outline: 2px solid #6366f1 !important;
          background-color: rgba(99, 102, 241, 0.05) !important;
        }
        /* Hover tooltip */
        .pw-visual-tooltip {
          position: fixed !important;
          background: #111827 !important;
          color: #f1f5f9 !important;
          padding: 6px 12px !important;
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
      </style>
      <script>
        (function() {
          // Send messages back to the parent window (supporting both iframe parent and window opener tabs)
          function notifyParent(data) {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage(data, '*');
            }
            if (window.opener && window.opener !== window) {
              window.opener.postMessage(data, '*');
            }
          }

          // Storage overrides removed to allow login sessions to persist across SPA navigations


          // Intercept XHR and Fetch calls to proxy absolute external URLs
          const originalFetch = window.fetch;
          window.fetch = function(input, init) {
            let url = '';
            if (typeof input === 'string') {
              url = input;
            } else if (input instanceof URL) {
              url = input.href;
            } else if (input && input.url) {
              url = input.url;
            }
            
            if (url && (url.startsWith('http') || url.startsWith('//')) && !url.includes(window.location.host) && !url.includes('127.0.0.1')) {
              const proxyUrl = '/api/proxy/request?url=' + encodeURIComponent(url);
              if (typeof input === 'string') {
                input = proxyUrl;
              } else if (input && input.url) {
                input = new Request(proxyUrl, input);
              }
            }
            return originalFetch.call(this, input, init);
          };

          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url, ...args) {
            if (typeof url === 'string' && (url.startsWith('http') || url.startsWith('//')) && !url.includes(window.location.host) && !url.includes('127.0.0.1')) {
              url = '/api/proxy/request?url=' + encodeURIComponent(url);
            }
            return originalOpen.call(this, method, url, ...args);
          };

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
            if (selectors.byId) return selectors.byId;
            if (selectors.byRole) return selectors.byRole;
            return selectors.css || '';
          }

          function extractElementData(el) {
            const tagName = el.tagName.toLowerCase();
            
            // Filter dynamic IDs (e.g. #headlessui-listbox-button-_r_11m_, #radix-123, generated hashes)
            let id = el.id || '';
            if (id && /headlessui|radix|mui|-[0-9]{4,}|^[a-f0-9]{8,}/i.test(id)) {
              id = '';
            }

            const name = el.getAttribute('name') || '';
            
            // Filter utility classes and complex Tailwind arbitrary values
            const className = el.className && typeof el.className === 'string'
              ? el.className.split(' ').filter(c => 
                  c.length > 0 && 
                  !c.includes('pw-visual') &&
                  !c.includes(':') && 
                  !c.includes('[') &&
                  !/^(flex|grid|block|absolute|relative|w-|h-|p-|m-|text-|bg-|border-)/.test(c)
                ).slice(0, 2).join(' ')
              : '';

            // Clean text matching
            let text = (el.textContent || '').replace(/[\\n\\r\\t ]+/g, ' ').trim();
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
              byText: "",
              css: "",
              xpath: ""
            };

            if (text && text.length > 0) {
              if (text.length > 30) {
                selectors.byText = "page.getByText('" + text.substring(0, 30).replace(/'/g, "\\\\'") + "', { exact: false })";
              } else {
                selectors.byText = "page.getByText('" + text.replace(/'/g, "\\\\'") + "', { exact: true })";
              }
            }

            const implicitRoles = {
              button: 'button',
              a: 'link',
              input: type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : 'textbox',
              select: 'combobox',
              textarea: 'textbox'
            };
            const effectiveRole = role || implicitRoles[tagName];
            if (effectiveRole) {
              const nameAttr = ariaLabel || (text.length <= 30 ? text : text.substring(0, 30));
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
              let actualUrl = lastUrl;
              if (lastUrl.includes('/api/proxy?url=')) {
                const match = lastUrl.match(/[\\?&]url=([^&]+)/);
                if (match) {
                  actualUrl = decodeURIComponent(match[1]);
                }
              }
              notifyParent({
                type: 'URL_CHANGED',
                url: actualUrl
              });
            }
          }, 500);
        })();
      </script>
    `;

    // Inject before closing head tag
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${injection}</head>`);
    } else {
      html = injection + html;
    }

    console.log('Sending response to iframe...');
    if (!isResponded) {
      isResponded = true;
      res.send(html);
    }
  } catch (err: any) {
    console.error('Proxy Error:', err);
    if (!isResponded) {
      isResponded = true;
      res.status(500).send(`Error loading page preview via proxy: ${err.message}`);
    }
  } finally {
    clearTimeout(hardTimeout);
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
});

export default router;
