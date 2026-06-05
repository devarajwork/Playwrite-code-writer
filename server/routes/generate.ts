import { Router } from 'express';
import { generateTestCode } from '../services/codeGenerator.js';
import type { GenerateRequest } from '../types.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

const router = Router();

// Generate code from steps
router.post('/', async (req, res) => {
  try {
    const request = req.body as GenerateRequest;

    if (!request.testName || !request.steps || request.steps.length === 0) {
      res.status(400).json({ error: 'Test name and at least one step are required' });
      return;
    }

    const code = generateTestCode(request);
    res.json({ code, testName: request.testName });
  } catch (error: any) {
    console.error('❌ Generate error:', error.message);
    res.status(500).json({ error: 'Failed to generate code', details: error.message });
  }
});

// Save generated code to file
router.post('/save', async (req, res) => {
  try {
    const { filename, code, saveLocation } = req.body;

    if (!filename || !code) {
      res.status(400).json({ error: 'Filename and code are required' });
      return;
    }

    let outputDir = join(projectRoot, 'generated-tests');
    if (saveLocation) {
      if (isAbsolute(saveLocation)) {
        outputDir = saveLocation;
      } else {
        outputDir = join(projectRoot, saveLocation);
      }
    }
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = join(outputDir, `${safeName}.spec.ts`);
    writeFileSync(filePath, code, 'utf-8');

    console.log(`💾 Saved test: ${filePath}`);
    res.json({ path: filePath, filename: `${safeName}.spec.ts` });
  } catch (error: any) {
    console.error('❌ Save error:', error.message);
    res.status(500).json({ error: 'Failed to save test file', details: error.message });
  }
});

// Open native folder browser dialog
router.post('/browse-folder', async (req, res) => {
  try {
    const windir = process.env.windir || process.env.SYSTEMROOT || 'C:\\Windows';
    const powershellPath = join(windir, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    
    // Run PowerShell in STA (Single Threaded Apartment) mode, which is required for COM shell dialog popups
    const psCommand = `"${powershellPath}" -NoProfile -STA -ExecutionPolicy Bypass -Command "$app = New-Object -ComObject Shell.Application; $folder = $app.BrowseForFolder(0, 'Select Test Save Location', 0); if ($folder) { Write-Host $folder.Self.Path } else { Write-Host 'CANCEL' }"`;

    const { stdout } = await execAsync(psCommand);
    const path = stdout.trim();

    if (path === 'CANCEL' || !path) {
      res.json({ cancelled: true });
    } else {
      res.json({ path });
    }
  } catch (error: any) {
    console.error('❌ Folder picker error:', error.message);
    res.status(500).json({ 
      error: 'Failed to open directory picker: ' + error.message, 
      details: error.stack 
    });
  }
});

export default router;
