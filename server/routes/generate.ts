import { Router } from 'express';
import { generateTestCode } from '../services/codeGenerator.js';
import type { GenerateRequest } from '../types.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, isAbsolute, basename } from 'path';
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

    let filePath: string;
    if (filename.endsWith('.ts') || filename.endsWith('.js')) {
      filePath = join(outputDir, filename);
    } else {
      const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
      filePath = join(outputDir, `${safeName}.spec.ts`);
    }

    writeFileSync(filePath, code, 'utf-8');

    console.log(`💾 Saved test: ${filePath}`);
    res.json({ path: filePath, filename: basename(filePath) });
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

router.get('/git-push', async (req, res) => {
  try {
    const { stdout, stderr } = await execAsync('node git-push.js', { cwd: projectRoot });
    res.json({ success: true, stdout, stderr });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stdout: error.stdout, stderr: error.stderr });
  }
});

// List saved test files
router.get('/files', async (req, res) => {
  try {
    const saveLocation = (req.query.location as string) || '';
    let outputDir = join(projectRoot, 'generated-tests');
    
    if (saveLocation) {
      if (isAbsolute(saveLocation)) {
        outputDir = saveLocation;
      } else {
        outputDir = join(projectRoot, saveLocation);
      }
    }
    
    if (!existsSync(outputDir)) {
      res.json({ files: [] });
      return;
    }

    const { readdirSync } = await import('fs');
    const files = readdirSync(outputDir)
      .filter(f => f.endsWith('.spec.ts'));
      
    res.json({ files });
  } catch (error: any) {
    console.error('❌ List files error:', error.message);
    res.status(500).json({ error: 'Failed to list files', details: error.message });
  }
});

// Get specific file content
router.get('/file', async (req, res) => {
  try {
    const saveLocation = (req.query.location as string) || '';
    const name = (req.query.name as string);
    
    if (!name) {
      res.status(400).json({ error: 'Filename is required' });
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
    
    const filePath = join(outputDir, name);
    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const { readFileSync } = await import('fs');
    const content = readFileSync(filePath, 'utf-8');
      
    res.json({ content });
  } catch (error: any) {
    console.error('❌ Get file error:', error.message);
    res.status(500).json({ error: 'Failed to get file', details: error.message });
  }
});

export default router;
