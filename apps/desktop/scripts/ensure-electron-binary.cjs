const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { downloadArtifact } = require('@electron/get');

async function main() {
  const electronPkgPath = require.resolve('electron/package.json');
  const electronDir = path.dirname(electronPkgPath);
  const { version } = require(electronPkgPath);
  const platformExe =
    process.platform === 'win32'
      ? 'electron.exe'
      : process.platform === 'darwin'
      ? 'Electron.app/Contents/MacOS/Electron'
      : 'electron';

  const distDir = path.join(electronDir, 'dist');
  const exePath = path.join(distDir, platformExe);
  const pathTxt = path.join(electronDir, 'path.txt');

  if (fs.existsSync(exePath) && fs.existsSync(pathTxt)) {
    console.log(`[desktop] Electron v${version} binary is ready.`);
    return;
  }

  console.log(`[desktop] Ensuring Electron v${version} binary for ${process.platform}-${process.arch}...`);
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform,
    arch: process.arch,
  });

  fs.mkdirSync(distDir, { recursive: true });
  if (process.platform === 'win32') {
    execFileSync('tar', ['-xf', zipPath, '-C', distDir], { stdio: 'inherit' });
  } else {
    execFileSync('unzip', ['-o', zipPath, '-d', distDir], { stdio: 'inherit' });
  }

  fs.writeFileSync(pathTxt, platformExe, 'utf8');
  console.log(`[desktop] Extracted Electron v${version} binary successfully.`);
}

main().catch((err) => {
  console.error('[desktop] Failed to ensure Electron binary:', err);
  process.exit(1);
});
