import crypto from 'crypto';
import http from 'http';
import { AddressInfo } from 'net';

export interface GoogleAuthLoopbackResult {
  accessToken: string;
}

export interface StartGoogleAuthOptions {
  serverUrl: string;
  openBrowser: (url: string) => Promise<void> | void;
  onSuccessFocus?: () => void;
  timeoutMs?: number;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function renderCallbackPage(success: boolean, message: string): string {
  const accent = success ? '#047857' : '#be123c';
  const title = success ? 'Đăng nhập Google thành công' : 'Không thể hoàn tất đăng nhập';
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Online Chess Desktop</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .card { max-width: 420px; width: calc(100% - 32px); background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.08); text-align: center; }
    .badge { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: #0f172a; color: #ffffff; font-size: 24px; margin-bottom: 14px; }
    h1 { margin: 0 0 8px; font-size: 19px; letter-spacing: -0.02em; color: ${accent}; }
    p { margin: 0; font-size: 14px; line-height: 1.6; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">&#9812;</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
  ${success ? '<script>setTimeout(() => { window.close(); }, 1800);</script>' : ''}
</body>
</html>`;
}

export class DesktopGoogleAuthBroker {
  private activeServer: http.Server | null = null;
  private activeTimer: NodeJS.Timeout | null = null;
  private activeReject: ((err: Error) => void) | null = null;

  cancel(reason = 'Đã hủy phiên đăng nhập Google.'): void {
    const reject = this.activeReject;
    this.cleanup();
    if (reject) {
      reject(new Error(reason));
    }
  }

  private cleanup(): void {
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    if (this.activeServer) {
      try {
        this.activeServer.close();
      } catch {
        // Ignore close errors
      }
      this.activeServer = null;
    }
    this.activeReject = null;
  }

  async start(options: StartGoogleAuthOptions): Promise<GoogleAuthLoopbackResult> {
    this.cancel('Đã bắt đầu phiên đăng nhập Google mới.');

    const state = crypto.randomBytes(24).toString('hex');
    const timeoutMs = options.timeoutMs ?? 180_000;
    const baseServerUrl = options.serverUrl.trim().replace(/\/+$/, '');

    return new Promise<GoogleAuthLoopbackResult>((resolve, reject) => {
      let settled = false;
      const finishResolve = (res: GoogleAuthLoopbackResult) => {
        if (settled) return;
        settled = true;
        this.cleanup();
        options.onSuccessFocus?.();
        resolve(res);
      };
      const finishReject = (err: Error) => {
        if (settled) return;
        settled = true;
        this.cleanup();
        reject(err);
      };

      this.activeReject = finishReject;

      const server = http.createServer((req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');

        const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
        if (reqUrl.pathname !== '/callback') {
          res.statusCode = 404;
          res.end(renderCallbackPage(false, 'Đường dẫn xác thực không hợp lệ.'));
          return;
        }

        const returnedState = reqUrl.searchParams.get('state') || '';
        if (!returnedState || !safeEqual(returnedState, state)) {
          res.statusCode = 400;
          res.end(
            renderCallbackPage(
              false,
              'Mã xác thực không khớp hoặc phiên đăng nhập đã hết hạn. Hãy thử lại từ Online Chess Desktop.'
            )
          );
          return;
        }

        const errorMsg = reqUrl.searchParams.get('error');
        if (errorMsg) {
          res.statusCode = 200;
          res.end(
            renderCallbackPage(
              false,
              'Bạn đã hủy hoặc không thể đăng nhập Google. Bạn có thể đóng tab này.'
            )
          );
          finishReject(new Error('Đăng nhập Google đã bị hủy trên trình duyệt.'));
          return;
        }

        const googleAccessToken = (reqUrl.searchParams.get('googleAccessToken') || '').trim();
        if (!googleAccessToken) {
          res.statusCode = 400;
          res.end(
            renderCallbackPage(
              false,
              'Thiếu mã xác thực Google. Hãy thử đăng nhập lại từ Online Chess Desktop.'
            )
          );
          finishReject(new Error('Không nhận được mã xác thực từ trình duyệt.'));
          return;
        }

        res.statusCode = 200;
        res.end(
          renderCallbackPage(
            true,
            'Bạn có thể đóng tab trình duyệt này và quay lại ứng dụng Online Chess Desktop.'
          )
        );
        finishResolve({ accessToken: googleAccessToken });
      });

      this.activeServer = server;

      server.on('error', (err) => {
        finishReject(new Error(`Không thể khởi tạo cổng xác thực cục bộ: ${err.message}`));
      });

      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo | null;
        if (!address || !address.port) {
          finishReject(new Error('Không lấy được cổng xác thực cục bộ.'));
          return;
        }

        const callbackUrl = `http://127.0.0.1:${address.port}/callback`;
        const loginUrl = `${baseServerUrl}/login?desktopCallback=${encodeURIComponent(
          callbackUrl
        )}&desktopState=${encodeURIComponent(state)}`;

        this.activeTimer = setTimeout(() => {
          finishReject(
            new Error('Quá thời gian chờ xác thực Google trên trình duyệt. Vui lòng thử lại.')
          );
        }, timeoutMs);

        Promise.resolve(options.openBrowser(loginUrl)).catch((err) => {
          finishReject(
            new Error(
              `Không thể mở trình duyệt hệ thống: ${err instanceof Error ? err.message : String(err)}`
            )
          );
        });
      });
    });
  }
}
