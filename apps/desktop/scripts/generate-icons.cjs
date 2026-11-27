const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const assetsDir = path.resolve(__dirname, '../assets');

// High-contrast Obsidian Tournament King icon crafted for 16px tray through 512px installer clarity
const DESKTOP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect x="16" y="16" width="480" height="480" rx="112" fill="#0f172a" />
  <rect x="24" y="24" width="464" height="464" rx="104" stroke="#334155" stroke-width="6" />
  <!-- Subtle tactical sky accent arc at top -->
  <path d="M128 32 H384" stroke="#0284c7" stroke-width="6" stroke-linecap="round" opacity="0.7" />
  <!-- Classic Staunton King Cross -->
  <rect x="241" y="78" width="30" height="86" rx="8" fill="#ffffff" />
  <rect x="214" y="102" width="84" height="28" rx="8" fill="#ffffff" />
  <!-- Crown Finial -->
  <ellipse cx="256" cy="184" rx="28" ry="20" fill="#ffffff" />
  <!-- Crown Lobes (Left, Center, Right) -->
  <path
    d="M150 328
       C112 292, 102 238, 134 206
       C164 176, 212 198, 232 236
       C238 206, 274 206, 280 236
       C300 198, 348 176, 378 206
       C410 238, 400 292, 362 328 Z"
    fill="#ffffff"
  />
  <!-- Inner Crown Accent Cutouts -->
  <path d="M158 310 C196 292, 316 292, 354 310" stroke="#0f172a" stroke-width="10" stroke-linecap="round" />
  <!-- Collar Band -->
  <rect x="148" y="328" width="216" height="30" rx="12" fill="#f1f5f9" />
  <!-- Pedestal Base -->
  <path d="M132 374 C132 364, 140 358, 150 358 H362 C372 358, 380 364, 380 374 V392 C380 404, 370 414, 358 414 H154 C142 414, 132 404, 132 392 Z" fill="#ffffff" />
  <rect x="120" y="406" width="272" height="22" rx="11" fill="#e2e8f0" />
</svg>`;

function buildIcoBuffer(entries) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const count = entries.length;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Icon type
  header.writeUInt16LE(count, 4);

  const dirBuffers = [];
  const dataBuffers = [];

  for (const { size, buffer } of entries) {
    const dir = Buffer.alloc(dirEntrySize);
    dir.writeUInt8(size >= 256 ? 0 : size, 0);
    dir.writeUInt8(size >= 256 ? 0 : size, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(buffer.length, 8);
    dir.writeUInt32LE(offset, 12);

    dirBuffers.push(dir);
    dataBuffers.push(buffer);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...dirBuffers, ...dataBuffers]);
}

async function renderSvgToPng(win, svgContent, size) {
  const dataUrl = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = ${size};
        canvas.height = ${size};
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, ${size}, ${size});
        ctx.drawImage(img, 0, 0, ${size}, ${size});
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = (err) => reject(String(err));
      img.src = 'data:image/svg+xml;base64,' + ${JSON.stringify(
        Buffer.from(svgContent, 'utf8').toString('base64')
      )};
    })
  `);

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  return Buffer.from(base64, 'base64');
}

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'icon.svg'), DESKTOP_ICON_SVG, 'utf8');

    const win = new BrowserWindow({
      width: 512,
      height: 512,
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
      },
    });

    await win.loadURL('data:text/html;charset=utf-8,<html><body style="margin:0"></body></html>');

    const sizes = [16, 32, 48, 64, 256, 512];
    const rendered = {};
    for (const size of sizes) {
      rendered[size] = await renderSvgToPng(win, DESKTOP_ICON_SVG, size);
    }

    fs.writeFileSync(path.join(assetsDir, 'icon.png'), rendered[512]);
    fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), rendered[32]);

    const icoBuffer = buildIcoBuffer([
      { size: 16, buffer: rendered[16] },
      { size: 32, buffer: rendered[32] },
      { size: 48, buffer: rendered[48] },
      { size: 64, buffer: rendered[64] },
      { size: 256, buffer: rendered[256] },
    ]);
    fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuffer);

    console.log('[desktop] Generated icon.svg, icon.png (512px), tray-icon.png (32px), and icon.ico');
    win.destroy();
    app.quit();
  } catch (err) {
    console.error('[desktop] Failed to generate icons:', err);
    app.exit(1);
  }
});
