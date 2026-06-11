import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconPath = path.join(__dirname, 'icon.png');

if (!fs.existsSync(iconPath)) {
  console.log('Downloading Playwright icon...');
  const iconTempPath = path.join(__dirname, 'icon-temp.png');
  https.get('https://raw.githubusercontent.com/microsoft/playwright-vscode/main/images/playwright-logo.png', res => {
    if (res.statusCode === 200) {
      const file = fs.createWriteStream(iconTempPath);
      res.pipe(file);
      file.on('finish', async () => {
        file.close();
        console.log('Icon downloaded successfully. Resizing to 512x512...');
        try {
          const sharp = (await import('sharp')).default;
          await sharp(iconTempPath)
            .resize(512, 512)
            .toFile(iconPath);
          fs.unlinkSync(iconTempPath);
          console.log('Icon resized successfully!');
        } catch (err) {
          console.error('Failed to resize icon:', err);
        }
      });
    } else {
      console.error('Failed to download icon:', res.statusCode);
    }
  }).on('error', err => {
    console.error('Error downloading icon:', err.message);
  });
} else {
  console.log('Icon already exists.');
}
