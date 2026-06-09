import { Router } from 'express';
import { chromium, type Page, type Locator } from 'playwright';
import { join } from 'path';
import { existsSync } from 'fs';
import type { TestStep } from '../types.js';

const router = Router();

function resolveLocator(page: Page, selectorStr: string): Locator {
  if (!selectorStr) {
    throw new Error('Selector string is empty');
  }
  
  if (selectorStr.startsWith('page.')) {
    try {
      const getLocator = new Function('page', `return ${selectorStr}`);
      return getLocator(page);
    } catch (err: any) {
      throw new Error(`Failed to parse locator "${selectorStr}": ${err.message}`);
    }
  }
  
  return page.locator(selectorStr);
}

router.post('/', async (req, res) => {
  const { steps, baseURL, disableAuth, frameworkPath, workspace } = req.body as { 
    steps: TestStep[]; 
    baseURL?: string;
    disableAuth?: boolean;
    frameworkPath?: string;
    workspace?: string;
  };

  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    res.status(400).json({ error: 'At least one step is required' });
    return;
  }

  // Set headers for Server-Sent Events (SSE) streaming over POST
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Prevent Nginx buffering if applicable

  function sendEvent(data: any) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
  console.log(`🚀 Streaming live execution for ${sortedSteps.length} steps...`);

  let browser;
  try {
    const launchArgs = [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ];
    browser = await chromium.launch({ headless: true, args: launchArgs });

    const contextOptions: any = {
      viewport: { width: 1280, height: 720 },
      baseURL: baseURL,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (!disableAuth && frameworkPath) {
      const authFile = workspace === 'pm' ? 'pm-user.json' : 'cx-user.json';
      const authPath = join(frameworkPath, 'playwright', '.auth', authFile);
      if (existsSync(authPath)) {
        contextOptions.storageState = authPath;
        sendEvent({ type: 'log', message: `🔒 Using ${workspace?.toUpperCase()} auth session: ${authFile}` });
      } else {
        sendEvent({ type: 'log', message: `⚠️ Auth file not found: ${authFile}` });
      }
    } else {
      sendEvent({ type: 'log', message: `⚠️ Running unauthenticated` });
    }

    const context = await browser.newContext(contextOptions);
    
    // Hide navigator.webdriver flag to bypass bot detection
    await context.addInitScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");
    
    const page = await context.newPage();
    let overallSuccess = true;

    for (const step of sortedSteps) {
      sendEvent({ type: 'step_start', id: step.id });

      const startTime = Date.now();
      let stepSuccess = true;
      let errorMsg = '';

      try {
        const sel = step.selector;
        const val = step.value;

        switch (step.type) {
          case 'navigate':
            let dest = val || sel;
            if (baseURL && dest.startsWith('http')) {
              try {
                const destUrl = new URL(dest);
                const baseUrlObj = new URL(baseURL);
                destUrl.protocol = baseUrlObj.protocol;
                destUrl.host = baseUrlObj.host;
                destUrl.port = baseUrlObj.port;
                dest = destUrl.toString();
              } catch (e) {
                // ignore parsing errors
              }
            } else if (baseURL && dest.startsWith('/')) {
              dest = baseURL.replace(/\/$/, '') + dest;
            }
            try {
              await page.goto(dest, { waitUntil: 'domcontentloaded', timeout: 15000 });
            } catch (e) {
              // Ignore navigation timeouts in live runner, page will likely still be painted
            }
            break;

          case 'click': {
            const loc = resolveLocator(page, sel);
            await loc.click({ timeout: 10000 });
            break;
          }

          case 'dblclick': {
            const loc = resolveLocator(page, sel);
            await loc.dblclick({ timeout: 10000 });
            break;
          }

          case 'fill': {
            const loc = resolveLocator(page, sel);
            if (step.delay !== undefined && step.delay > 0) {
              await loc.pressSequentially(val, { delay: step.delay, timeout: 10000 });
            } else {
              await loc.fill(val, { timeout: 10000 });
            }
            break;
          }

          case 'select': {
            const loc = resolveLocator(page, sel);
            await loc.selectOption(val, { timeout: 10000 });
            break;
          }

          case 'check': {
            const loc = resolveLocator(page, sel);
            await loc.check({ timeout: 10000 });
            break;
          }

          case 'uncheck': {
            const loc = resolveLocator(page, sel);
            await loc.uncheck({ timeout: 10000 });
            break;
          }

          case 'hover': {
            const loc = resolveLocator(page, sel);
            await loc.hover({ timeout: 10000 });
            break;
          }

          case 'press': {
            const loc = resolveLocator(page, sel);
            await loc.press(val, { timeout: 10000 });
            break;
          }

          case 'scrollTo': {
            const loc = resolveLocator(page, sel);
            await loc.scrollIntoViewIfNeeded({ timeout: 10000 });
            break;
          }

          case 'waitForSelector': {
            const timeout = val ? parseInt(val, 10) : 10000;
            if (sel.startsWith('page.')) {
              const loc = resolveLocator(page, sel);
              await loc.waitFor({ state: 'visible', timeout });
            } else {
              await page.waitForSelector(sel, { state: 'visible', timeout });
            }
            break;
          }

          case 'waitForTimeout': {
            const timeout = val ? parseInt(val, 10) : 1000;
            await page.waitForTimeout(timeout);
            break;
          }

          case 'assertVisible': {
            const loc = resolveLocator(page, sel);
            const visible = await loc.isVisible({ timeout: 10000 });
            if (!visible) {
              throw new Error(`Element is not visible`);
            }
            break;
          }

          case 'assertText': {
            const loc = resolveLocator(page, sel);
            const text = await loc.innerText();
            if (!text.includes(val)) {
              throw new Error(`Expected text "${val}" but found "${text}"`);
            }
            break;
          }

          case 'assertValue': {
            const loc = resolveLocator(page, sel);
            const inputValue = await loc.inputValue();
            if (inputValue !== val) {
              throw new Error(`Expected value "${val}" but found "${inputValue}"`);
            }
            break;
          }

          case 'assertUrl': {
            const currentUrl = page.url();
            if (!currentUrl.includes(val)) {
              throw new Error(`Expected URL to contain "${val}" but found "${currentUrl}"`);
            }
            break;
          }

          case 'screenshot':
            break;

          default:
            throw new Error(`Unsupported step type: ${step.type}`);
        }
      } catch (err: any) {
        stepSuccess = false;
        errorMsg = err.message;
        overallSuccess = false;
      }

      // Capture screenshot after step runs to show live website progress
      let screenshotBase64 = '';
      try {
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        screenshotBase64 = screenshotBuffer.toString('base64');
      } catch (screenshotErr: any) {
        console.error('Failed to capture runtime step screenshot:', screenshotErr.message);
      }

      sendEvent({
        type: 'step_end',
        id: step.id,
        success: stepSuccess,
        duration: Date.now() - startTime,
        error: errorMsg,
        screenshot: screenshotBase64,
      });

      if (!stepSuccess) {
        break; // Stop running steps on error
      }
    }

    sendEvent({
      type: 'complete',
      success: overallSuccess,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Run execution error:', error.message);
    sendEvent({ type: 'error', message: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
    res.end();
  }
});

export default router;
