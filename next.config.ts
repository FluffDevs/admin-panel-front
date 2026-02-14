import type { NextConfig } from "next";
import util from 'util';

// Quick runtime patch to avoid Node's DeprecationWarning from util._extend
// Some bundled dependency (http-proxy inside next) still calls util._extend which
// emits a deprecation warning. Override it early so the old API call won't trigger
// the warning. This is temporary — prefer updating Next when a fix is released.
try {
  const u = util as unknown as Record<string, unknown>;
  if (typeof u._extend === 'function') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - runtime assignment to deprecated internal API (temporary workaround)
    u._extend = Object.assign;
  }
} catch {
  /* ignore */
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://nu8n9r0hl5.execute-api.eu-west-1.amazonaws.com';

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/api/musics/:path*',
        destination: `${API_BASE}/musics/:path*`,
      },
      {
        source: '/api/musics',
        destination: `${API_BASE}/musics`,
      },
    ];
  },
};

export default nextConfig;
