import { Router } from 'express';
import { scanUrl } from '../services/scanner.js';
import type { ScanRequest } from '../types.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { url } = req.body as ScanRequest;

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: 'Invalid URL format. Must include protocol (https://)' });
      return;
    }

    console.log(`🔍 Scanning: ${url}`);
    const result = await scanUrl(url);
    console.log(`✅ Found ${result.elementCount} elements on ${url}`);

    res.json(result);
  } catch (error: any) {
    console.error('❌ Scan error:', error.message);
    res.status(500).json({
      error: 'Failed to scan URL',
      details: error.message,
    });
  }
});

export default router;
