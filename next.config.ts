import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ignore ESLint errors during production build on Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: ['calm-stinkbug-pure.ngrok-free.app'],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.pstatic.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'livecloud-thumb.akamaized.net',
        port: '',
        pathname: '/**',
      },
      { protocol: 'https', hostname: 'yt3.ggpht.com', pathname: '/**' },
    ],
  },
};

export default nextConfig;
