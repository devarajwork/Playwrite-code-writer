import { parsePlaywrightScript } from './src/utils/helpers.js';
import fs from 'fs';

try {
  const code = fs.readFileSync('C:/Users/admin/Project/Playwrite jugl trial/tests/login cx/scenario-1.spec.ts', 'utf8');
  const result = parsePlaywrightScript(code);
  fs.writeFileSync('output.json', JSON.stringify(result, null, 2));
} catch(e) {
  fs.writeFileSync('output.json', JSON.stringify({ error: e.message }));
}
