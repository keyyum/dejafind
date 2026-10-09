import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next dev would otherwise append generated text to AGENTS.md, which is hand-written here.
  agentRules: false,
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
