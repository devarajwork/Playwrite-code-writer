const fs = require('fs');
const { execSync } = require('child_process');

try {
  const stdout = execSync('git remote -v', { cwd: 'C:\\Users\\admin\\Project\\Playwrite jugl trial' }).toString();
  fs.writeFileSync('C:\\Users\\admin\\Project\\Playwrite Tester\\debug-git.txt', "STDOUT:\n" + stdout);
  const match = stdout.match(/origin\s+(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^.\s]+)/);
  fs.appendFileSync('C:\\Users\\admin\\Project\\Playwrite Tester\\debug-git.txt', "\nMATCH:\n" + JSON.stringify(match));
} catch (e) {
  fs.writeFileSync('C:\\Users\\admin\\Project\\Playwrite Tester\\debug-git.txt', "ERROR:\n" + e.message);
}
