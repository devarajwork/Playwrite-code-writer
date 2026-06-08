import { Router } from 'express';
import express from 'express';
import { existsSync, readdirSync, statSync, mkdirSync, rmSync, renameSync, writeFileSync, readFileSync } from 'fs';
import { join, isAbsolute, dirname, basename } from 'path';
import { spawn, ChildProcess, execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const router = Router();
let activeFrameworkPath = '';
let activeProcess: ChildProcess | null = null;

function resolveFrameworkPath(rawPath: string): string | null {
  if (!rawPath) return null;
  const p = isAbsolute(rawPath) ? rawPath : join(process.cwd(), rawPath);
  if (!existsSync(p)) return null;
  if (!existsSync(join(p, 'package.json'))) return null;
  if (!existsSync(join(p, 'playwright.config.ts')) && !existsSync(join(p, 'playwright.config.js'))) return null;
  return p;
}

// ─── GET /api/framework/status ─────────────────────────────────────────────
// Checks if the given path is a valid Playwright project
router.get('/status', (req, res) => {
  const rawPath = (req.query.path as string) || '';
  const resolved = resolveFrameworkPath(rawPath);

  if (!resolved) {
    res.json({ connected: false, error: 'Path not found or not a Playwright project' });
    return;
  }
  
  activeFrameworkPath = resolved;

  // Check if playwright/.auth exists
  const hasAuth = existsSync(join(resolved, 'playwright', '.auth', 'user.json'));

  res.json({
    connected: true,
    path: resolved,
    hasAuth,
  });
});

// ─── STATIC /api/framework/report ───────────────────────────────────────────
// Serves the playwright HTML report
router.use('/report', (req, res, next) => {
  if (req.query.path) {
    const p = resolveFrameworkPath(req.query.path as string);
    if (p) activeFrameworkPath = p;
  }

  if (!activeFrameworkPath) {
    res.status(404).send('No active framework connected. Please connect in the app first.');
    return;
  }
  const reportDir = join(activeFrameworkPath, 'playwright-report');
  if (!existsSync(reportDir)) {
    res.status(404).send('Playwright report not found. Please run tests first to generate it.');
    return;
  }
  express.static(reportDir)(req, res, next);
});

// ─── GET /api/framework/tree ───────────────────────────────────────────────
// Returns a recursive tree of the tests directory
router.get('/tree', (req, res) => {
  const rawPath = (req.query.path as string) || '';
  const resolved = resolveFrameworkPath(rawPath);

  if (!resolved) {
    res.status(400).json({ error: 'Invalid framework path' });
    return;
  }

  const testsDir = join(resolved, 'tests');
  
  if (!existsSync(testsDir)) {
    res.json({ name: 'tests', type: 'folder', path: 'tests', children: [] });
    return;
  }

  function buildTree(dirPath: string, relativePath: string): any {
    const name = basename(dirPath);
    const result: any = {
      name,
      path: relativePath,
      type: 'folder',
      children: []
    };

    try {
      const items = readdirSync(dirPath);
      for (const item of items) {
        const itemPath = join(dirPath, item);
        const itemRelative = relativePath ? `${relativePath}/${item}` : item;
        const stat = statSync(itemPath);

        if (stat.isDirectory()) {
          result.children.push(buildTree(itemPath, itemRelative));
        } else {
          result.children.push({
            name: item,
            path: itemRelative,
            type: 'file'
          });
        }
      }
      
      // Sort: folders first, then files alphabetically
      result.children.sort((a: any, b: any) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      });
      
    } catch (e) {
      // Ignore read errors for specific folders
    }
    
    return result;
  }

  const tree = buildTree(testsDir, 'tests');
  res.json(tree);
});

// ─── GET /api/framework/tags ───────────────────────────────────────────────
// Returns a unique list of tags found in all test files
router.get('/tags', (req, res) => {
  const rawPath = (req.query.path as string) || '';
  const resolved = resolveFrameworkPath(rawPath);

  if (!resolved) {
    res.status(400).json({ error: 'Invalid framework path' });
    return;
  }

  const testsDir = join(resolved, 'tests');
  const tags = new Set<string>();

  if (!existsSync(testsDir)) {
    res.json([]);
    return;
  }

  function scanForTags(dirPath: string) {
    try {
      const items = readdirSync(dirPath);
      for (const item of items) {
        const itemPath = join(dirPath, item);
        const stat = statSync(itemPath);

        if (stat.isDirectory()) {
          scanForTags(itemPath);
        } else if (item.endsWith('.ts') || item.endsWith('.js')) {
          const content = readFileSync(itemPath, 'utf-8');
          // Match @tag but exclude if followed by a slash (like @playwright/test)
          const matches = content.match(/@[\w-]+(?!\/)/g);
          if (matches) {
            matches.forEach(t => {
              if (t !== '@playwright' && t !== '@ts-check') {
                tags.add(t);
              }
            });
          }
        }
      }
    } catch (e) {
      console.error('Error scanning for tags:', e);
    }
  }

  scanForTags(testsDir);
  const sortedTags = Array.from(tags).sort();
  res.json(sortedTags);
});

// ─── POST /api/framework/folder ────────────────────────────────────────────
// Create a new folder
router.post('/folder', (req, res) => {
  const { frameworkPath, folderPath } = req.body;
  const resolved = resolveFrameworkPath(frameworkPath);
  
  if (!resolved) {
    res.status(400).json({ error: 'Invalid framework path' });
    return;
  }

  // Prevent path traversal
  if (folderPath.includes('..')) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  const targetPath = join(resolved, folderPath);
  try {
    if (!existsSync(targetPath)) {
      mkdirSync(targetPath, { recursive: true });
    }
    res.json({ success: true, path: targetPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/framework/file ────────────────────────────────────────────
// Create a new file
router.post('/file', (req, res) => {
  const { frameworkPath, filePath, content = '' } = req.body;
  const resolved = resolveFrameworkPath(frameworkPath);
  
  if (!resolved) {
    res.status(400).json({ error: 'Invalid framework path' });
    return;
  }

  if (filePath.includes('..')) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  const targetPath = join(resolved, filePath);
  try {
    const dir = dirname(targetPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(targetPath, content, 'utf-8');
    res.json({ success: true, path: targetPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/framework/item ────────────────────────────────────────────
// Delete a file or folder
router.delete('/item', (req, res) => {
  const { frameworkPath, itemPath } = req.body;
  const resolved = resolveFrameworkPath(frameworkPath);
  
  if (!resolved) {
    res.status(400).json({ error: 'Invalid framework path' });
    return;
  }

  if (itemPath.includes('..')) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  // Extra safety: only allow deleting inside tests directory
  if (!itemPath.startsWith('tests/') && itemPath !== 'tests') {
    res.status(403).json({ error: 'Can only delete items inside tests directory' });
    return;
  }

  const targetPath = join(resolved, itemPath);
  try {
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/framework/rename ─────────────────────────────────────────────
// Rename a file or folder
router.put('/rename', (req, res) => {
  const { frameworkPath, oldPath, newPath } = req.body;
  const resolved = resolveFrameworkPath(frameworkPath);
  
  if (!resolved) {
    res.status(400).json({ error: 'Invalid framework path' });
    return;
  }

  if (oldPath.includes('..') || newPath.includes('..')) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  const targetOldPath = join(resolved, oldPath);
  const targetNewPath = join(resolved, newPath);
  
  try {
    if (existsSync(targetOldPath)) {
      // Ensure the parent directory of the new path exists
      const dir = dirname(targetNewPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      renameSync(targetOldPath, targetNewPath);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/framework/run ───────────────────────────────────────────────
// Runs npm test (or a specific script) in the framework directory, streaming output
router.get('/run', (req, res) => {
  const { path: frameworkPath, script, module: moduleName, modulePath, headed } = req.query as {
    path: string;
    script?: 'all' | 'setup' | 'module' | 'tag';
    module?: string;
    modulePath?: string;
    headed?: string;
  };

  const resolved = resolveFrameworkPath(frameworkPath);
  if (!resolved) {
    res.status(400).json({ error: 'Invalid framework path' });
    return;
  }
  activeFrameworkPath = resolved;

  let cmd = 'node';
  let cmdArgs = ['node_modules/@playwright/test/cli.js', 'test'];

  if (script === 'setup') {
    cmdArgs.push('--project=setup');
  } else if (script === 'module' && (moduleName || modulePath)) {
    // Playwright uses the CLI argument to match against files within its testDir (which is usually ./tests)
    // If we pass 'tests/modules/test.spec.ts', it might resolve to 'tests/tests/modules/test.spec.ts'.
    // Passing just the moduleName or a relative path from the testDir works perfectly.
    
    let filterPattern = moduleName;
    if (modulePath) {
      if (modulePath.startsWith('tests/')) {
        filterPattern = modulePath.substring(6);
      } else {
        filterPattern = modulePath;
      }
      // On Windows, the absolute path has backslashes, so a forward slash regex might fail.
      // Replace forward slashes with the OS-specific separator
      if (process.platform === 'win32') {
        filterPattern = filterPattern.replace(/\//g, '\\\\');
      }
    }
    
    cmdArgs.push(filterPattern as string);
  } else if (script === 'tag' && moduleName) {
    cmdArgs.push('--grep', moduleName);
  }

  if (headed === 'true') {
    cmdArgs.push('--headed');
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  function sendEvent(data: any) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }



  sendEvent({ type: 'start', command: `${cmd} ${cmdArgs.join(' ')}`, cwd: resolved });

  const child = spawn(cmd, cmdArgs, {
    cwd: resolved,
    shell: false,
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  activeProcess = child;

  child.stdout.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        sendEvent({ type: 'stdout', line: line });
      }
    });
  });

  child.stderr.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        sendEvent({ type: 'stderr', line: line });
      }
    });
  });

  child.on('close', (code, signal) => {
    activeProcess = null;
    // code is null when process was killed by a signal (Windows: abnormal exit)
    // Treat null exit code as failure
    const exitCode = code ?? (signal ? 1 : 1);
    const success = exitCode === 0;
    sendEvent({ type: 'complete', exitCode, signal: signal || null, success });
    res.end();
  });

  child.on('error', (err) => {
    activeProcess = null;
    sendEvent({ type: 'error', message: err.message });
    res.end();
  });

  // If client disconnects, we should technically kill the child, 
  // but let's disable this temporarily to see if it's the culprit causing immediate exits
  // req.on('close', () => {
  //   child.kill();
  // });
});

// ─── POST /api/framework/stop ──────────────────────────────────────────────
// Stops the currently running test
router.post('/stop', (req, res) => {
  if (activeProcess && activeProcess.pid) {
    try {
      if (process.platform === 'win32') {
        // Use taskkill to kill the whole process tree to avoid orphan browsers
        execSync(`taskkill /pid ${activeProcess.pid} /t /f`);
      } else {
        activeProcess.kill();
      }
      activeProcess = null;
      res.json({ success: true, message: 'Test process killed' });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  } else {
    res.json({ success: false, message: 'No running process found' });
  }
});

// ─── GET /api/framework/report ─────────────────────────────────────────────
// Checks if an HTML report exists
router.get('/report', (req, res) => {
  const rawPath = (req.query.path as string) || '';
  const resolved = resolveFrameworkPath(rawPath);

  if (!resolved) {
    res.status(400).json({ error: 'Invalid framework path' });
    return;
  }

  const reportDir = join(resolved, 'playwright-report');
  const hasReport = existsSync(join(reportDir, 'index.html'));

  res.json({ hasReport, reportDir: hasReport ? reportDir : null });
});

// ─── POST /api/framework/git-push ───────────────────────────────────────────
router.post('/git-push', async (req, res) => {
  try {
    const { frameworkPath, commitMessage } = req.body;
    if (!frameworkPath) return res.status(400).json({ error: 'frameworkPath required' });

    const msg = commitMessage || 'Update tests from Playwright Builder';
    
    // Chain the commands safely
    const cmd = `git add . && git commit -m "${msg.replace(/"/g, '\\"')}" && git push`;
    
    const { stdout, stderr } = await execAsync(cmd, { cwd: frameworkPath });
    res.json({ success: true, stdout, stderr });
  } catch (error: any) {
    // Note: if git commit fails because there are no changes, it throws an error in execAsync
    res.status(500).json({ error: error.message, stdout: error.stdout, stderr: error.stderr });
  }
});

async function getGithubRepoInfo(cwd: string): Promise<{owner: string, repo: string}> {
  const { stdout } = await execAsync('git remote -v', { cwd });
  const match = stdout.match(/origin\s+(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^.\s]+)/);
  if (!match) throw new Error('Could not determine GitHub repository from git remote -v. Ensure "origin" points to a github repo.');
  return { owner: match[1], repo: match[2] };
}

router.get('/prs', async (req, res) => {
  try {
    const rawPath = (req.query.path as string) || '';
    const resolved = resolveFrameworkPath(rawPath);
    if (!resolved) return res.status(400).json({ error: 'Invalid framework path' });

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing GitHub Token' });

    const { owner, repo } = await getGithubRepoInfo(resolved);
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls?state=open`;

    const fetchResponse = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': authHeader,
        'User-Agent': 'Playwright-Tester-App'
      }
    });

    if (!fetchResponse.ok) {
      const err = await fetchResponse.json().catch(() => ({}));
      return res.status(fetchResponse.status).json({ error: err.message || 'GitHub API error' });
    }

    const data = await fetchResponse.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/prs/create', async (req, res) => {
  try {
    const { frameworkPath, title, body, head, base } = req.body;
    const resolved = resolveFrameworkPath(frameworkPath);
    if (!resolved) return res.status(400).json({ error: 'Invalid framework path' });

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing GitHub Token' });

    const { owner, repo } = await getGithubRepoInfo(resolved);
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls`;

    const fetchResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'Playwright-Tester-App'
      },
      body: JSON.stringify({ title, body, head, base })
    });

    if (!fetchResponse.ok) {
      const err = await fetchResponse.json().catch(() => ({}));
      return res.status(fetchResponse.status).json({ error: err.message || 'GitHub API error' });
    }

    const data = await fetchResponse.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/prs/merge', async (req, res) => {
  try {
    const { frameworkPath, pullNumber } = req.body;
    const resolved = resolveFrameworkPath(frameworkPath);
    if (!resolved) return res.status(400).json({ error: 'Invalid framework path' });

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing GitHub Token' });

    const { owner, repo } = await getGithubRepoInfo(resolved);
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/merge`;

    const fetchResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'Playwright-Tester-App'
      }
    });

    if (!fetchResponse.ok) {
      const err = await fetchResponse.json().catch(() => ({}));
      return res.status(fetchResponse.status).json({ error: err.message || 'GitHub API error' });
    }

    const data = await fetchResponse.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
