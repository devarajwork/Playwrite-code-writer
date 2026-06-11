import { getFrameworkAssets } from './utils/api.js';

const STEP_TYPE_INFO = {
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

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  let targetUrl = urlParams.get('url');
  let fwPath = urlParams.get('fwPath') || localStorage.getItem('fwPath');

  // Defense-in-depth: if the URL accidentally contains the old proxy prefix, strip it
  if (targetUrl && targetUrl.includes('/api/proxy?url=')) {
    const match = targetUrl.match(/[?&]url=([^&]+)/);
    if (match) {
      targetUrl = decodeURIComponent(match[1]);
    }
  }
  
  if (!targetUrl) {
    document.body.innerHTML = '<div style="padding: 20px;">No URL provided. Please launch from the Playwright Tester app.</div>';
    return;
  }

  const dom = {
    type: document.getElementById('step-type'),
    selector: document.getElementById('step-selector'),
    selectorWrapper: document.getElementById('selector-choices-wrapper'),
    selectorDropdown: document.getElementById('selector-choices-dropdown'),
    value: document.getElementById('step-value'),
    description: document.getElementById('step-description'),
    selectorGroup: document.getElementById('selector-group'),
    valueGroup: document.getElementById('value-group'),
    ifElseGroup: document.getElementById('if-else-group'),
    ifActionInput: document.getElementById('step-if-action'),
    elseActionInput: document.getElementById('step-else-action'),
    optionalGroup: document.getElementById('optional-group'),
    stepOptional: document.getElementById('step-optional'),
    addBtn: document.getElementById('add-step-btn'),
    status: document.getElementById('status-message')
  };

  dom.selectorDropdown.addEventListener('change', () => {
    if (dom.selectorDropdown.value) {
      dom.selector.value = dom.selectorDropdown.value;
    }
  });

  const updateStepTypeFields = () => {
    const type = dom.type.value;
    const info = STEP_TYPE_INFO[type];

    if (!info) return;

    // Show/hide selector field
    dom.selectorGroup.style.display = info.needsSelector ? 'block' : 'none';

    // Show/hide value field
    dom.valueGroup.style.display = (info.needsValue && type !== 'ifElse') ? 'block' : 'none';

    // Show/hide If/Else fields
    if (dom.ifElseGroup) {
      if (type === 'ifElse') dom.ifElseGroup.classList.remove('hidden');
      else dom.ifElseGroup.classList.add('hidden');
    }

    // Show/hide Optional checkbox
    if (dom.optionalGroup) {
      if (type === 'ifElse' || type === 'navigate') dom.optionalGroup.classList.add('hidden');
      else dom.optionalGroup.classList.remove('hidden');
    }

    // Update placeholder
    if (info.valuePlaceholder !== undefined) {
      dom.value.placeholder = info.valuePlaceholder;
    } else {
      dom.value.placeholder = '';
    }

    // Handle list attribute for upload type
    if (type === 'upload') {
      dom.value.setAttribute('list', 'inspector-asset-files-list');
    } else {
      dom.value.removeAttribute('list');
    }
  };

  dom.type.addEventListener('change', updateStepTypeFields);
  updateStepTypeFields();

  const processInspectorEvent = (data) => {
    if (data.type === 'ELEMENT_CLICKED' || data.type === 'INPUT_CHANGED') {
      let { bestSelector, tagName, value, selectors } = data.element;
      
      const typeMap = {
        button: 'click', input: 'fill', select: 'select',
        textarea: 'fill', a: 'click', h1: 'assertText',
        h2: 'assertText', h3: 'assertText', h4: 'assertText',
        h5: 'assertText', h6: 'assertText',
      };
      
      let type = typeMap[tagName] || 'click';
      if (value && type === 'click' && typeof value === 'string' && value.indexOf('{"position"') !== 0) type = 'fill';
      
      let processedValue = value || '';
      if (data.element && data.element.type && data.element.type.toLowerCase() === 'file') {
        type = 'upload';
        bestSelector = "page.locator('input[type=\"file\"]')";
        if (processedValue) processedValue = processedValue.replace(/C:\\fakepath\\/i, 'assets/');
      }
      
      dom.type.value = type;
      dom.selector.value = bestSelector;
      dom.value.value = processedValue;
      if (type === 'upload') {
        dom.description.value = 'Upload file ' + processedValue;
      } else if (type === 'click' && processedValue) {
        dom.description.value = 'Click on ' + tagName + ' with offset';
      } else if (processedValue) {
        dom.description.value = 'Fill "' + processedValue + '" into ' + tagName;
      } else {
        dom.description.value = 'Click on ' + tagName;
      }
      
      updateStepTypeFields();

      // Populate selector choices
      dom.selectorDropdown.innerHTML = '';
      if (selectors && Object.keys(selectors).length > 0) {
        let bestKey = '';
        for (const [key, selValue] of Object.entries(selectors)) {
          if (!selValue) continue;
          const option = document.createElement('option');
          option.value = selValue;
          option.textContent = `${key}: ${selValue}`;
          dom.selectorDropdown.appendChild(option);
          
          if (selValue === bestSelector) bestKey = selValue;
        }
        if (bestKey) {
          dom.selectorDropdown.value = bestKey;
        }
        dom.selectorWrapper.classList.remove('hidden');
      } else {
        dom.selectorWrapper.classList.add('hidden');
      }

      // Auto-Record logic
      const autoRecordToggle = document.getElementById('auto-record-toggle');
      if (autoRecordToggle && autoRecordToggle.checked) {
        // Automatically add step and flash the record indicator
        dom.addBtn.click();
        const indicator = document.getElementById('record-indicator');
        if (indicator) {
          indicator.classList.remove('hidden');
          setTimeout(() => indicator.classList.add('hidden'), 300);
        }
      }
    }
  };

  // Check if we are running inside Electron
  const isElectron = navigator.userAgent.toLowerCase().includes('electron');

  if (isElectron) {
    // Hide headful fallback UI and show iframe
    const fallbackUi = document.getElementById('headful-fallback-ui');
    const webview = document.getElementById('inspector-iframe');
    if (fallbackUi) fallbackUi.classList.add('hidden');
    if (webview) {
      webview.classList.remove('hidden');
      
      // Fetch the injection script once
      let injectScriptText = '';
      try {
        console.log('[Inspector] Fetching /inspector-inject.js...');
        const res = await fetch('/inspector-inject.js');
        injectScriptText = await res.text();
        console.log('[Inspector] Successfully loaded injection script, length:', injectScriptText.length);
      } catch (err) {
        console.error('[Inspector] Failed to load inspector-inject.js:', err);
      }
      
      webview.addEventListener('console-message', (e) => {
        if (e.message && e.message.startsWith('INSPECTOR_EVENT:')) {
          try {
            const data = JSON.parse(e.message.substring(16));
            processInspectorEvent(data);
          } catch (err) {
            console.error('[Inspector] Parse error on IPC:', err);
          }
        }
      });

      webview.addEventListener('dom-ready', () => {
        console.log('[Inspector] Webview dom-ready event fired!');
        if (injectScriptText) {
          webview.executeJavaScript(injectScriptText).then(() => {
            console.log('[Inspector] Successfully injected script into webview');
          }).catch(e => {
            console.error('[Inspector] Failed to inject into webview. Error:', e);
          });
        }
      });
      
      console.log('[Inspector] Setting webview src to:', targetUrl);
      webview.src = targetUrl;
    }
  } else {
    // Fallback: Start the headful inspector browser
    try {
      const res = await fetch('/api/inspector/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
    } catch (e) {
      document.body.innerHTML = `<div style="padding: 20px; color: #ef4444;">Failed to start inspector: ${e.message}</div>`;
      return;
    }

    // Listen to SSE stream from the headful browser
    const eventSource = new EventSource('/api/inspector/stream');
    
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'CONNECTED') {
          const statusEl = document.getElementById('connection-status');
          if (statusEl) {
            statusEl.innerHTML = '<span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></span>Connected to Browser';
            statusEl.style.color = '#10b981';
          }
        } else if (data.type === 'BROWSER_CLOSED') {
          const statusEl = document.getElementById('connection-status');
          if (statusEl) {
            statusEl.innerHTML = '<span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 8px #ef4444;"></span>Browser Closed';
            statusEl.style.color = '#ef4444';
            statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
            statusEl.style.borderColor = 'rgba(239, 68, 68, 0.2)';
          }
        } else if (data.type === 'ELEMENT_CLICKED' || data.type === 'INPUT_CHANGED') {
          processInspectorEvent(data);
        }
      } catch (err) {
        console.error('SSE Error:', err);
      }
    };
    
    // Clean up browser when inspector window is closed
    window.addEventListener('beforeunload', () => {
      navigator.sendBeacon('/api/inspector/stop');
    });
  }
  
  try {
    if (fwPath) {
      const assetsObj = await getFrameworkAssets(fwPath);
      if (assetsObj.files && assetsObj.files.length > 0) {
        const datalist = document.getElementById('inspector-asset-files-list');
        if (datalist) {
          datalist.innerHTML = assetsObj.files.map(f => `<option value="${f.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`).join('');
        }
      }
    }
  } catch (e) {
    console.error('Failed to load assets in inspector', e);
  }

  // Handle Add Step button
  dom.addBtn.addEventListener('click', () => {
    const selector = dom.selector.value.trim();
    if (!selector) {
      alert("Please select an element first by clicking in the website on the right.");
      return;
    }

    const type = dom.type.value;
    const value = dom.value.value;
    const description = dom.description.value;
    const optional = dom.stepOptional ? dom.stepOptional.checked : false;

    const step = {
      type,
      selector,
      value,
      description,
      optional
    };

    if (type === 'ifElse') {
      step.ifAction = dom.ifActionInput ? dom.ifActionInput.value.trim() : '';
      step.elseAction = dom.elseActionInput ? dom.elseActionInput.value.trim() : '';
    }

    // Send step to the main tab (opener)
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'ADD_STEP_MANUAL', step }, '*');
      
      // Show success message briefly
      dom.status.style.display = 'block';
      setTimeout(() => {
        dom.status.style.display = 'none';
      }, 2000);
    } else {
      alert("Cannot find the main Playwright Tester tab. Make sure you opened this inspector from the app.");
    }
  });
});
