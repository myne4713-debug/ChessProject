const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { resolveDesktopBuildEnv } = require('./load-env.cjs');

const rootDir = path.resolve(__dirname, '../../..');
const desktopDir = path.resolve(__dirname, '..');
const webDistDir = path.resolve(rootDir, 'apps/web/dist');
const desktopRendererDir = path.resolve(desktopDir, 'renderer');

const buildEnv = resolveDesktopBuildEnv();

// Build shared + web bundle using the resolved desktop .env server URLs
const childEnv = {
  ...process.env,
  VITE_API_URL: buildEnv.apiUrl,
  VITE_SOCKET_URL: buildEnv.serverUrl,
};
if (buildEnv.googleClientId) {
  childEnv.VITE_GOOGLE_CLIENT_ID = buildEnv.googleClientId;
}

if (process.env.DESKTOP_SKIP_WEB_BUILD !== '1') {
  console.log(`[desktop] Building @online-chess/web with VITE_SOCKET_URL=${buildEnv.serverUrl}`);
  execSync('npm run build:web', {
    cwd: rootDir,
    env: childEnv,
    stdio: 'inherit',
  });
}

if (!fs.existsSync(webDistDir) || !fs.existsSync(path.join(webDistDir, 'index.html'))) {
  console.error(
    `[desktop] Web build output not found at ${webDistDir}. Run "npm run build:web" first.`
  );
  process.exit(1);
}

// Copy built web renderer into apps/desktop/renderer for Electron packaging
fs.rmSync(desktopRendererDir, { recursive: true, force: true });
fs.cpSync(webDistDir, desktopRendererDir, { recursive: true });
console.log(`[desktop] Copied web renderer bundle to ${desktopRendererDir}`);
