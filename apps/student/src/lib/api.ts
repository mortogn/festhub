import type { AppType } from "@festhub/api";
import { hc } from "hono/client";

let refreshPromise: Promise<boolean> | null = null;

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) throw new Error("Set NEXT_PUBLIC_API_URL env variable");

async function refreshToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh-token`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => (refreshPromise = null));
  }

  return refreshPromise;
}

const customFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);

  if (response.status !== 401) return response;

  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  const pathname = new URL(url, API_URL).pathname;

  if (pathname === "/auth/refresh-token") {
    return response;
  }

  const refreshed = await refreshToken();

  if (!refreshed) return response;

  return customFetch(input, init);
};

const client = hc<AppType>(API_URL, {
  fetch: customFetch,
  init: { credentials: "include" },
});

export default client;
