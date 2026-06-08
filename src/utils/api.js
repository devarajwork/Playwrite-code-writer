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

export async function listSavedTests(saveLocation = '') {
  const params = new URLSearchParams();
  if (saveLocation) params.append('location', saveLocation);
  
  const response = await fetch(`${API_BASE}/generate/files?${params.toString()}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to list saved tests');
  }
  return response.json();
}

export async function loadSavedTest(name, saveLocation = '') {
  const params = new URLSearchParams({ name });
  if (saveLocation) params.append('location', saveLocation);
  
  const response = await fetch(`${API_BASE}/generate/file?${params.toString()}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load test');
  }
  return response.json();
}

// ─── Framework Management API ───────────────────────────────────────────────

export async function getFrameworkStatus(frameworkPath) {
  const params = new URLSearchParams({ path: frameworkPath });
  const response = await fetch(`${API_BASE}/framework/status?${params.toString()}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Status check failed');
  }
  return response.json();
}

export async function getFrameworkScripts(frameworkPath) {
  const params = new URLSearchParams({ path: frameworkPath });
  const response = await fetch(`${API_BASE}/framework/scripts?${params.toString()}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to list scripts');
  }
  return response.json();
}

export async function runFramework(frameworkPath, script = 'all', moduleName = '', modulePath = '', headed = true) {
  const response = await fetch(`${API_BASE}/framework/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameworkPath, script, module: moduleName, modulePath, headed }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Framework run failed');
  }
  return response; // SSE stream
}

export async function getFrameworkReport(frameworkPath) {
  const params = new URLSearchParams({ path: frameworkPath });
  const response = await fetch(`${API_BASE}/framework/report?${params.toString()}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Report check failed');
  }
  return response.json();
}

export async function loadFrameworkFile(frameworkPath, folder, filename) {
  // folder is the relative path (e.g. 'tests/setup').
  // The backend file API uses absolute paths. Let's adapt it.
  const fullPath = folder ? `${frameworkPath}\\${folder}` : frameworkPath;
  return loadSavedTest(filename, fullPath);
}

export async function getFrameworkTree(frameworkPath) {
  const params = new URLSearchParams({ path: frameworkPath, t: Date.now().toString() });
  const response = await fetch(`${API_BASE}/framework/tree?${params.toString()}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to get tree');
  }
  return response.json();
}

export async function getFrameworkTags(frameworkPath) {
  const params = new URLSearchParams({ path: frameworkPath });
  const response = await fetch(`${API_BASE}/framework/tags?${params.toString()}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to get tags');
  }
  return response.json();
}

export async function createFrameworkFolder(frameworkPath, folderPath) {
  const response = await fetch(`${API_BASE}/framework/folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameworkPath, folderPath }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create folder');
  }
  return response.json();
}

export async function createFrameworkFile(frameworkPath, filePath, content = '') {
  const response = await fetch(`${API_BASE}/framework/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameworkPath, filePath, content }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create file');
  }
  return response.json();
}

export async function deleteFrameworkItem(frameworkPath, itemPath) {
  const response = await fetch(`${API_BASE}/framework/item`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameworkPath, itemPath }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete item');
  }
  return response.json();
}

export async function renameFrameworkItem(frameworkPath, oldPath, newPath) {
  const response = await fetch(`${API_BASE}/framework/rename`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameworkPath, oldPath, newPath }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to rename item');
  }
  return response.json();
}

export async function pushFrameworkToGit(frameworkPath, commitMessage) {
  const response = await fetch(`${API_BASE}/framework/git-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameworkPath, commitMessage }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Git push failed');
  }
  return response.json();
}

export async function getFrameworkPRs(frameworkPath, githubPat) {
  const response = await fetch(`${API_BASE}/framework/prs?path=${encodeURIComponent(frameworkPath)}`, {
    headers: { 'Authorization': `token ${githubPat}` }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch PRs');
  }
  return response.json();
}

export async function createFrameworkPR(frameworkPath, githubPat, data) {
  const response = await fetch(`${API_BASE}/framework/prs/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `token ${githubPat}` },
    body: JSON.stringify({ frameworkPath, ...data }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create PR');
  }
  return response.json();
}

export async function mergeFrameworkPR(frameworkPath, githubPat, pullNumber) {
  const response = await fetch(`${API_BASE}/framework/prs/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `token ${githubPat}` },
    body: JSON.stringify({ frameworkPath, pullNumber }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to merge PR');
  }
  return response.json();
}
