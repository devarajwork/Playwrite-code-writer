import { parsePlaywrightScript } from './src/utils/helpers.js';
import fs from 'fs';

const code = fs.readFileSync('C:/Users/admin/Project/Playwrite jugl trial/tests/login cx/scenario-1.spec.ts', 'utf8');
const result = parsePlaywrightScript(code);
console.log('Result length:', result.steps.length);
if (result.steps.length === 0) {
  console.log('Body:', code);
} else {
  console.log(result.steps);
}
