import { Router } from 'express';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { resolveLocator } from './run.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

let isLaunching = false;

router.post('/start', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  if (isLaunching) {
    res.status(429).json({ error: 'Already launching inspector' });
    return;
  }
  isLaunching = true;

  try {
    if (inspectorBrowser) {
      try {
        await inspectorBrowser.close();
      } catch (e) {
        console.warn('Failed to close previous browser:', e);
      }
      inspectorBrowser = null;
      inspectorContext = null;
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

    // Load the advanced semantic engine dynamically
    let injectScriptPath = path.join(__dirname, '../../dist/client/inspector-inject.js');
    if (!fs.existsSync(injectScriptPath)) {
      injectScriptPath = path.join(__dirname, '../../public/inspector-inject.js');
    }
    let injectScriptContent = '';
    try {
      injectScriptContent = fs.readFileSync(injectScriptPath, 'utf-8');
    } catch(e) {
      console.error('Failed to load inspector-inject.js. Check path:', injectScriptPath, e);
    }

    // Add init script
    await inspectorContext.addInitScript(`
      ${injectScriptContent}
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
  } finally {
    isLaunching = false;
  }
});

router.post('/verify', async (req, res) => {
    const { selector } = req.body;
    if (!inspectorContext) {
        return res.status(400).json({ error: 'Inspector is not running' });
    }

    try {
        const pages = inspectorContext.pages();
        if (pages.length > 0) {
            await pages[0].evaluate((sel) => {
                if ((window as any).highlightPlaywrightSelector) {
                    (window as any).highlightPlaywrightSelector(sel);
                }
            }, selector);
        }
        res.json({ success: true });
    } catch (err: any) {
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
