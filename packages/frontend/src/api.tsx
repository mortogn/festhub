import type { AppType } from "@festhub/api";
import { hc } from "hono/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL)
  throw new Error("Set NEXT_PUBLIC_API_URL in this app's environment");

let refreshPromise: Promise<boolean> | null = null;
function refreshToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh-token`, {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export const authenticatedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const pathname = new URL(url, API_URL).pathname;
  if (response.status !== 401 || pathname.startsWith("/auth/")) return response;
  if (!(await refreshToken())) return response;
  // Retry once: a fresh token may still be rejected, and must not cause recursion.
  return fetch(input, init);
};

const client = hc<AppType>(API_URL, {
  fetch: authenticatedFetch,
  init: { credentials: "include" },
});
export default client;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Hono's validator can merge its 400 JSON payload into the endpoint's output
// union. It cannot be returned after the HTTP success check below.
type Success<R extends Response> = Exclude<
  Awaited<ReturnType<R["json"]>>,
  { success: false }
>;

function responseErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  if (
    "message" in data &&
    typeof data.message === "string" &&
    data.message.trim()
  )
    return data.message.replace(/\s+/g, " ").trim();

  // Hono's Zod validator returns { success: false, error: { issues: [...] } }.
  const error = "error" in data ? data.error : null;
  if (
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray(error.issues)
  ) {
    const messages = error.issues.flatMap((issue: unknown) => {
      if (
        !issue ||
        typeof issue !== "object" ||
        !("message" in issue) ||
        typeof issue.message !== "string"
      )
        return [];
      const path =
        "path" in issue && Array.isArray(issue.path)
          ? issue.path
              .filter(
                (part: unknown) =>
                  typeof part === "string" || typeof part === "number",
              )
              .join(".")
          : "";
      const label = path.replace(/([a-z])([A-Z])/g, "$1 $2");
      return [
        label
          ? `${label[0]!.toUpperCase()}${label.slice(1)}: ${issue.message}`
          : issue.message,
      ];
    });
    if (messages.length) return [...new Set(messages)].join("\n");
  }
  return null;
}

export async function readResponse<R extends Response>(
  response: R,
): Promise<Success<R>> {
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const message =
      responseErrorMessage(data) ??
      "Unable to complete this request. Please try again.";
    if (response.status === 401 && typeof window !== "undefined")
      window.dispatchEvent(new Event("festhub:session-expired"));
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<Success<R>>;
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Could not connect. Please try again.";
}
