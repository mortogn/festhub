const languageKey = (userId?: string) =>
  `festhub:preferred-language:${userId ?? "anonymous"}`;

export function getPreferredLanguage(userId?: string) {
  try {
    return localStorage.getItem(languageKey(userId)) ?? "";
  } catch {
    return "";
  }
}

export function setPreferredLanguage(userId: string | undefined, id: string) {
  try {
    localStorage.setItem(languageKey(userId), id);
  } catch {
    // Storage may be unavailable (private mode); the preference is optional.
  }
}
