import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // O App Router lida com API routes e SSR nativamente,
  // então o antigo server.ts (Express) não é mais necessário.
  reactStrictMode: true,
};

export default nextConfig;
