import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_ORIGIN, resolveRendererFile } from '../src/protocolResolver';

const tempDirs: string[] = [];

function createMockRenderer(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'online-chess-renderer-'));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html></html>', 'utf8');
  fs.writeFileSync(path.join(dir, 'chess-icon.svg'), '<svg></svg>', 'utf8');
  fs.writeFileSync(path.join(dir, 'assets', 'main.js'), 'console.log("ok")', 'utf8');
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Desktop Custom Protocol Resolver (app://online-chess)', () => {
  it('resolves root and static assets inside renderer directory', () => {
    const root = createMockRenderer();
    expect(resolveRendererFile(root, `${APP_ORIGIN}/`)).toBe(path.join(root, 'index.html'));
    expect(resolveRendererFile(root, `${APP_ORIGIN}/chess-icon.svg`)).toBe(
      path.join(root, 'chess-icon.svg')
    );
    expect(resolveRendererFile(root, `${APP_ORIGIN}/assets/main.js`)).toBe(
      path.join(root, 'assets', 'main.js')
    );
  });

  it('falls back to index.html for SPA client routes', () => {
    const root = createMockRenderer();
    expect(resolveRendererFile(root, `${APP_ORIGIN}/lobby?join=ABC123`)).toBe(
      path.join(root, 'index.html')
    );
    expect(resolveRendererFile(root, `${APP_ORIGIN}/game/abc-123`)).toBe(
      path.join(root, 'index.html')
    );
  });

  it('returns null for missing static files with extensions', () => {
    const root = createMockRenderer();
    expect(resolveRendererFile(root, `${APP_ORIGIN}/assets/missing.js`)).toBeNull();
    expect(resolveRendererFile(root, `${APP_ORIGIN}/missing.png`)).toBeNull();
  });

  it('blocks path traversal and foreign hosts/schemes', () => {
    const root = createMockRenderer();
    expect(resolveRendererFile(root, `${APP_ORIGIN}/../package.json`)).toBeNull();
    expect(resolveRendererFile(root, `${APP_ORIGIN}/%2e%2e/package.json`)).toBeNull();
    expect(resolveRendererFile(root, 'app://other-host/index.html')).toBeNull();
    expect(resolveRendererFile(root, 'http://online-chess/index.html')).toBeNull();
  });
});
