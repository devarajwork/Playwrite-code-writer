document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const targetUrl = urlParams.get('url');
  
  if (!targetUrl) {
    document.body.innerHTML = '<div style="padding: 20px;">No URL provided. Please launch from the Playwright Tester app.</div>';
    return;
  }

  const iframe = document.getElementById('proxy-iframe');
  const loading = document.getElementById('loading');
  
  // Set iframe source to the proxy
  iframe.src = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  
  iframe.onload = () => {
    loading.classList.add('hidden');
  };

  const dom = {
    type: document.getElementById('step-type'),
    selector: document.getElementById('step-selector'),
    selectorWrapper: document.getElementById('selector-choices-wrapper'),
    selectorDropdown: document.getElementById('selector-choices-dropdown'),
    value: document.getElementById('step-value'),
    description: document.getElementById('step-description'),
    addBtn: document.getElementById('add-step-btn'),
    status: document.getElementById('status-message')
  };

  dom.selectorDropdown.addEventListener('change', () => {
    if (dom.selectorDropdown.value) {
      dom.selector.value = dom.selectorDropdown.value;
    }
  });

  // Handle messages from the proxy iframe
  window.addEventListener('message', (e) => {
    if (e.data && (e.data.type === 'ELEMENT_CLICKED' || e.data.type === 'INPUT_CHANGED')) {
      const { bestSelector, tagName, value, selectors } = e.data.element;
      
      const typeMap = {
        button: 'click', input: 'fill', select: 'select',
        textarea: 'fill', a: 'click', h1: 'assertText',
        h2: 'assertText', h3: 'assertText', h4: 'assertText',
        h5: 'assertText', h6: 'assertText',
      };
      
      let type = typeMap[tagName] || 'click';
      if (value && type === 'click') type = 'fill';
      
      dom.type.value = type;
      dom.selector.value = bestSelector;
      dom.value.value = value || '';
      dom.description.value = value ? `Fill "${value}" into ${tagName}` : `Click on ${tagName}`;

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
    }
  });

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

    const step = {
      type,
      selector,
      value,
      description
    };

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
