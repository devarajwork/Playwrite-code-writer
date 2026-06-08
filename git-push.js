const { execSync } = require('child_process');

try {
  const status = execSync('git status').toString();
  console.log("STATUS:\n", status);
  execSync('git add .');
  console.log("ADDED");
  execSync('git commit -m "Update run by tag and parsing"');
  console.log("COMMITTED");
  execSync('git push');
  console.log("PUSHED");
} catch (e) {
  console.error("ERROR:");
  console.error(e.stdout ? e.stdout.toString() : '');
  console.error(e.stderr ? e.stderr.toString() : '');
  console.error(e.message);
}
