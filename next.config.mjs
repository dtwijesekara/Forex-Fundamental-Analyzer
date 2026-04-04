/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Tell Next.js these packages are server-only — never bundle for the browser
  serverExternalPackages: [
    'yahoo-finance2',
    'node-cron',
    'node-telegram-bot-api',
  ],

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent browser bundle from trying to resolve Node.js built-ins
      // that server-only packages (yahoo-finance2, etc.) depend on
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        child_process: false,
        http2: false,
        stream: false,
        crypto: false,
        os: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
