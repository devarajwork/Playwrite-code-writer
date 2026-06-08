import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconPath = path.join(__dirname, 'icon.png');

if (!fs.existsSync(iconPath)) {
  console.log('Downloading Playwright icon...');
  https.get('https://raw.githubusercontent.com/microsoft/playwright-vscode/main/images/playwright-logo.png', res => {
    if (res.statusCode === 200) {
      res.pipe(fs.createWriteStream(iconPath));
      console.log('Icon downloaded successfully.');
    } else {
      console.error('Failed to download icon:', res.statusCode);
    }
  }).on('error', err => {
    console.error('Error downloading icon:', err.message);
  });
} else {
  console.log('Icon already exists.');
}
