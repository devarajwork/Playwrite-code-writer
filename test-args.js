const { spawn } = require('child_process');
const fs = require('fs');

const out = fs.openSync('args-test-out.txt', 'w');

// First create a dump-args.js script
fs.writeFileSync('dump-args.js', 'console.log("ARGS:", process.argv.slice(2));');

const child = spawn('node', ['dump-args.js', 'login cx/scenario-1.spec.ts', '"login cx/quoted"'], { shell: true, stdio: ['ignore', out, out] });
child.on('close', () => {
  const result = fs.readFileSync('args-test-out.txt', 'utf8');
  fs.writeFileSync('C:\\Users\\admin\\Project\\Playwrite Tester\\debug-args.txt', result);
});
