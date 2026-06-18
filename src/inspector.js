// Get the target URL from query params
const urlParams = new URLSearchParams(window.location.search);
const targetUrl = urlParams.get('url');

function processInspectorEvent(data) {
  // Send the event back to the main builder window via postMessage
  if (window.opener) {
    window.opener.postMessage(data, '*');
  } else {
    console.error('No window.opener found to send inspector events');
  }
}

async function init() {
  if (!targetUrl) {
    document.querySelector('.main-content').innerHTML = `
      <div style="color: #ef4444;">No URL provided to inspector</div>
    `;
    return;
  }

  // Start the headful inspector browser
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
    document.querySelector('.main-content').innerHTML = `
      <div style="color: #ef4444; padding: 20px;">Failed to start inspector: ${e.message}</div>
    `;
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
          statusEl.innerHTML = '<div class="status-dot"></div>Connected to Chrome';
          statusEl.style.color = '#10b981';
          statusEl.style.background = 'rgba(16, 185, 129, 0.1)';
          statusEl.style.borderColor = 'rgba(16, 185, 129, 0.2)';
        }
      } else if (data.type === 'BROWSER_CLOSED') {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
          statusEl.innerHTML = '<div class="status-dot"></div>Browser Closed';
          statusEl.style.color = '#ef4444';
          statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
          statusEl.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        }
      } else if (data.type === 'VERIFY_RESULT') {
        // Pass verify result back via IPC
        processInspectorEvent(data);
      } else if (data.type === 'ELEMENT_CLICKED' || data.type === 'INPUT_CHANGED' || data.type === 'URL_CHANGED') {
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

init();
