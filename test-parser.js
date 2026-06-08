const fs = require('fs');

function parsePlaywrightScript(code) {
  const steps = [];
  let testName = 'Imported Test';
  let tags = '';
  
  const nameMatch = code.match(/test\(\s*['"`](.*?)['"`]/);
  if (nameMatch) {
    let parsedName = nameMatch[1];
    const tagsMatch = parsedName.match(/(@[\w-]+)/g);
    if (tagsMatch) {
      testName = parsedName.replace(/(@[\w-]+)/g, '').trim();
      tags = tagsMatch.join(' ');
    } else {
      testName = parsedName;
    }
  }

  // Extract steps inside the test body.
  const bodyMatch = code.match(/test\([\s\S]*?,\s*async\s*\(\s*\{\s*page\s*\}\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)\s*;?/);
  if (!bodyMatch) {
    console.log("BODY MATCH FAILED");
    return { testName, tags, steps };
  }
  
  const body = bodyMatch[1];
  const lines = body.split('\n');
  
  let currentDescription = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.startsWith('//')) {
      currentDescription = line.substring(2).trim();
      continue;
    }
    
    let type = '';
    
    if (line.includes('page.goto(')) type = 'navigate';
    else if (line.includes('.click(')) type = 'click';
    else if (line.includes('.fill(')) type = 'fill';
    else if (line.includes('.selectOption(')) type = 'select';
    else if (line.includes('page.waitForTimeout(')) type = 'waitForTimeout';
    
    if (type) {
      steps.push({ type });
    }
  }
  return { testName, tags, steps };
}

const code = fs.readFileSync('c:/Users/admin/Project/Playwrite jugl trial/tests/login cx/scenario-1.spec.ts', 'utf8');
const result = parsePlaywrightScript(code);
console.log('Result length:', result.steps.length);
