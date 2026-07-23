import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Generates a self-contained output for Docker (no full node_modules needed at runtime)
  output: "standalone",
  // Cache client-side navigations to reduce RSC requests
  experimental: {
    webpackBuildWorker: false,
    staleTimes: {
      dynamic: 30,  // 30s cache for dynamic RSC payloads
      static: 180,  // 3min cache for static RSC payloads
    },
  },
  // Cache images aggressively
  images: {
    minimumCacheTTL: 86400, // 1 day
  },
};

export default nextConfig;
