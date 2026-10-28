import type { NextConfig } from "next";

// Allows next/image to load uploads from the API origin
// (NEXT_PUBLIC_IMAGE_ORIGIN, e.g. https://api.example.com).
export function uploadImages(): NonNullable<NextConfig["images"]> {
  const origin = process.env.NEXT_PUBLIC_IMAGE_ORIGIN?.trim();
  if (!origin)
    throw new Error("Set NEXT_PUBLIC_IMAGE_ORIGIN in this app's environment");

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_IMAGE_ORIGIN must be a valid URL, received "${origin}"`,
    );
  }

  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return {
    remotePatterns: [
      {
        protocol: url.protocol === "https:" ? "https" : "http",
        hostname: url.hostname,
        port: url.port,
        pathname: "/upload/**",
      },
    ],
    // Next blocks optimizer fetches to private IPs; needed for local dev only.
    ...(isLocal && process.env.NODE_ENV !== "production"
      ? { dangerouslyAllowLocalIP: true }
      : {}),
  };
}
