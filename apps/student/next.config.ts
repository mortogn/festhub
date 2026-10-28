import type { NextConfig } from "next";
import { uploadImages } from "../../packages/frontend/src/image-config";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
    // Avoid stale Tailwind plugin output when restoring a previous build cache.
    // https://github.com/vercel/next.js/issues/100326
    turbopackFileSystemCacheForBuild: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: uploadImages(),
  transpilePackages: ["@festhub/shared", "@festhub/frontend"],
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
