import type { NextConfig } from "next";
import { uploadImages } from "../../packages/frontend/src/image-config";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  cacheComponents: true,
  images: uploadImages(),
  transpilePackages: ["@festhub/shared", "@festhub/frontend"],
  partialPrefetching: true,
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
