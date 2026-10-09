import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The dev indicator's HMR sync pings registry.npmjs.org to check for a newer
  // Next.js version; that's a real outbound request our requestsOut counter
  // correctly flags, and the demo needs requestsOut at 0 with Wi-Fi off.
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3", "sqlite-vec", "sharp", "pdf-parse"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
