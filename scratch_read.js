const fs = require('fs');
const file = 'C:\\Users\\admin\\Project\\Playwrite jugl trial\\tests\\modules\\jugl-cx-login-test.spec.ts';
try {
  let content = fs.readFileSync(file, 'utf-8');
  console.log(content);
} catch (e) {
  console.error(e);
}
