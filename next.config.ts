import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignore ESLint errors during production build on Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
