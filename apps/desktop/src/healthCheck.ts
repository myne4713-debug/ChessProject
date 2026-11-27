import { normalizeServerUrl } from './settingsStore';
import { ServerHealthResult } from './types';

export async function checkServerHealth(
  rawServerUrl: string,
  timeoutMs = 4500
): Promise<ServerHealthResult> {
  const startedAt = Date.now();
  let serverUrl: string;

  try {
    serverUrl = normalizeServerUrl(rawServerUrl);
  } catch (err) {
    return {
      ok: false,
      serverUrl: rawServerUrl,
      latencyMs: 0,
      error: err instanceof Error ? err.message : 'Địa chỉ máy chủ không hợp lệ.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${serverUrl}/api/v1/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    const latencyMs = Date.now() - startedAt;
    let payload: Record<string, unknown> | null = null;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        serverUrl,
        statusCode: response.status,
        latencyMs,
        error: `Máy chủ phản hồi mã lỗi HTTP ${response.status}.`,
      };
    }

    const data = (payload?.data as Record<string, unknown> | undefined) ?? payload ?? {};
    return {
      ok: true,
      serverUrl,
      statusCode: response.status,
      latencyMs,
      database: typeof data.database === 'string' ? data.database : undefined,
      uptime: typeof data.uptime === 'number' ? data.uptime : undefined,
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      serverUrl,
      latencyMs,
      error: isAbort
        ? `Quá thời gian kết nối (${timeoutMs}ms). Kiểm tra lại máy chủ.`
        : 'Không thể kết nối tới máy chủ. Hãy đảm bảo backend đang chạy.',
    };
  } finally {
    clearTimeout(timer);
  }
}
