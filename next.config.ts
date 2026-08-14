import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // O App Router lida com API routes e SSR nativamente,
  // então o antigo server.ts (Express) não é mais necessário.
  reactStrictMode: true,

  webpack(config, { dev }) {
    if (dev) {
      try {
        require.resolve('@dhiwise/component-tagger/nextLoader');
        config.module.rules.push({
          test: /\.(jsx|tsx)$/,
          exclude: [/node_modules/],
          use: [{
            loader: '@dhiwise/component-tagger/nextLoader',
          }],
        });
      } catch (e) {
        // @dhiwise/component-tagger not available, skip
      }
    }

    return config;
  }
};

export default nextConfig;
