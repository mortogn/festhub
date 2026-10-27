import type { NextConfig } from "next";
const config: NextConfig = {
  experimental: { turbopackFileSystemCacheForBuild: false },
  transpilePackages: ["@festhub/shared", "@festhub/frontend", "@festhub/ui"],
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
};
export default config;
