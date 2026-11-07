import { env } from './env';

/**
 * Validates whether an incoming HTTP or WebSocket Origin header is permitted.
 * Supports development mode, configured domains, localhost, LAN IP addresses (Wi-Fi/Ethernet),
 * and secure development tunnels (Cloudflare Tunnel, ngrok, localtunnel).
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  // Allow requests without Origin header (curl, Postman, mobile native apps, same-origin reverse proxy)
  if (!origin) return true;

  // In non-production development mode, permit all origins (LAN testing from phones, tablets, tunnels)
  if (env.NODE_ENV !== 'production') {
    return true;
  }

  // Check against explicitly configured CORS_ORIGIN (supports comma-separated list or wildcard)
  const configuredOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
    return true;
  }

  // Allow localhost, 127.0.0.1 and IPv6 loopback
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
    return true;
  }

  // Allow private network LAN IP ranges (RFC 1918: 192.168.x.x, 10.x.x.x, 172.16.x.x - 172.31.x.x)
  if (
    /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
      origin
    )
  ) {
    return true;
  }

  // Allow public test tunnels
  if (
    origin.endsWith('.trycloudflare.com') ||
    origin.endsWith('.ngrok-free.app') ||
    origin.endsWith('.ngrok.io') ||
    origin.endsWith('.loca.lt')
  ) {
    return true;
  }

  return false;
}

export const dynamicCorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
};
