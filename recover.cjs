const fs = require('fs');

const path = 'C:\\Users\\devar\\.gemini\\antigravity-ide\\brain\\79aabbfa-2885-4b16-a07a-da004366bffc\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');

for (const line of lines) {
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      for (const call of obj.tool_calls) {
        if (call.name === 'default_api:multi_replace_file_content' || call.name === 'default_api:replace_file_content') {
          if (call.args.TargetFile && call.args.TargetFile.endsWith('main.js')) {
            console.log('--- FOUND MODIFICATION ---');
            console.log(JSON.stringify(call.args, null, 2));
          }
        }
      }
    }
  } catch (e) {}
}
