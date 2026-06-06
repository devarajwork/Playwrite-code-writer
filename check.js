const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\admin\\Project\\Playwrite Tester\\src\\main.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('fwSetupList') || line.includes('fwModulesList') || line.includes('fwNewSetupBtn') || line.includes('fwNewModuleBtn')) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
