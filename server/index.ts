import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import scanRouter from './routes/scan.js';
import generateRouter from './routes/generate.js';
import runRouter from './routes/run.js';
import proxyRouter from './routes/proxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware – allow all origins in production (restrict as needed)
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve Vite-built frontend from dist/client
const clientDist = path.join(__dirname, '..', 'client');
app.use(express.static(clientDist));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/scan', scanRouter);
app.use('/api/generate', generateRouter);
app.use('/api/run', runRouter);
app.use('/api/proxy', proxyRouter);

// Catch-all reverse proxy middleware to fetch target site assets and APIs to bypass CORS
app.use(async (req, res, next) => {
  // Check cookie first
  const cookieHeader = req.headers.cookie || '';
  let targetOrigin = '';
  const cookieMatch = cookieHeader.match(/proxy_target_origin=([^;]+)/);
  if (cookieMatch) {
    targetOrigin = decodeURIComponent(cookieMatch[1]);
  }

  // Fallback to Referer
  if (!targetOrigin) {
    const referer = req.headers.referer;
    if (referer && referer.includes('/api/proxy?url=')) {
      const match = referer.match(/[\?&]url=([^&]+)/);
      if (match) {
        try {
          const targetUrl = decodeURIComponent(match[1]);
          targetOrigin = new URL(targetUrl).origin;
        } catch {}
      }
    }
  }

  if (!targetOrigin) {
    next();
    return;
  }

  try {
    let path = req.originalUrl;
    if (path.startsWith('/api/proxy/')) {
      path = path.replace('/api/proxy/', '/');
    }
    const destUrl = `${targetOrigin}${path}`;

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    headers['host'] = new URL(targetOrigin).host;
    delete headers['content-length'];
    delete headers['connection'];
    delete headers['accept-encoding'];

    let bodyInit: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      bodyInit = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(destUrl, {
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
    console.error(`⚠️ Sub-resource proxy error for ${req.originalUrl}:`, err.message);
    next();
  }
});

// Catch-all: serve index.html for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('  🎭 Playwright Test Builder — Server');
  console.log(`  ➜  Listening on port ${PORT}`);
  console.log(`  ➜  API:    http://localhost:${PORT}/api`);
  console.log(`  ➜  Health: http://localhost:${PORT}/api/health`);
  console.log('');
});
