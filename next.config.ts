import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      fs: { browser: '' },
      path: { browser: '' },
      crypto: { browser: '' },
    },
  },  /* config options here */
};

export default nextConfig;
