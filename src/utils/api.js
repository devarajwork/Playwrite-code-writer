// API Client — communicates with the Express backend

const API_BASE = '/api';

export async function scanUrl(url) {
  const response = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Scan failed');
  }

  return response.json();
}

export async function generateCode(testName, testDescription, steps, baseURL) {
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testName, testDescription, steps, baseURL }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Code generation failed');
  }

  return response.json();
}

export async function saveTest(filename, code, saveLocation = '') {
  const response = await fetch(`${API_BASE}/generate/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, code, saveLocation }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Save failed');
  }

  return response.json();
}

export async function runTestSteps(steps) {
  const response = await fetch(`${API_BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steps }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Test execution failed');
  }

  return response;
}

export async function browseSaveLocation() {
  const response = await fetch(`${API_BASE}/generate/browse-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to open directory picker');
  }

  return response.json();
}
