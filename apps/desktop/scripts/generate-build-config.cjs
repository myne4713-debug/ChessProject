const fs = require('fs');
const path = require('path');
const { resolveDesktopBuildEnv } = require('./load-env.cjs');

const desktopDir = path.resolve(__dirname, '..');
const desktopDistDir = path.resolve(desktopDir, 'dist');

const buildEnv = resolveDesktopBuildEnv();

fs.mkdirSync(desktopDistDir, { recursive: true });
const buildConfig = {
  defaultServerUrl: buildEnv.serverUrl,
  defaultApiUrl: buildEnv.apiUrl,
  builtAt: new Date().toISOString(),
};

const outPath = path.join(desktopDistDir, 'build-config.json');
fs.writeFileSync(outPath, JSON.stringify(buildConfig, null, 2), 'utf8');
console.log(`[desktop] Embedded build-config.json -> defaultServerUrl=${buildEnv.serverUrl}`);
