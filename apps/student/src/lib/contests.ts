// Inlined at build time; ignore values that are not absolute http(s) URLs so
// links never resolve relative to this site.
function configuredBase() {
  const value = process.env.NEXT_PUBLIC_CONTEST_WEB_URL?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

export function contestsHomeUrl() {
  return configuredBase()?.href;
}

export function contestUrl(slug?: string | null) {
  const base = configuredBase();
  if (!base || !slug) return undefined;
  const root = new URL(base.href);
  if (!root.pathname.endsWith("/")) root.pathname += "/";
  return new URL(`contests/${encodeURIComponent(slug)}`, root).href;
}
