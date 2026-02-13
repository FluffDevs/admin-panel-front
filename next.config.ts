import type { NextConfig } from "next";

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
