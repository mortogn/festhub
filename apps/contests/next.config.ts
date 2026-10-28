import type { NextConfig } from "next";
import { uploadImages } from "../../packages/frontend/src/image-config";
const config: NextConfig = {
  experimental: { turbopackFileSystemCacheForBuild: false },
  images: uploadImages(),
  transpilePackages: ["@festhub/shared", "@festhub/frontend", "@festhub/ui"],
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
};
export default config;
