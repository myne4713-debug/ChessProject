const fs = require('fs');
const path = require('path');

const webDistDir = path.resolve(__dirname, '../../web/dist');
const desktopRendererDir = path.resolve(__dirname, '../renderer');

if (!fs.existsSync(webDistDir) || !fs.existsSync(path.join(webDistDir, 'index.html'))) {
  console.error(
    `[desktop] Web build output not found at ${webDistDir}. Run "npm run build:web" first.`
  );
  process.exit(1);
}

fs.rmSync(desktopRendererDir, { recursive: true, force: true });
fs.cpSync(webDistDir, desktopRendererDir, { recursive: true });
console.log(`[desktop] Copied web renderer bundle to ${desktopRendererDir}`);
