export function authRedirect(value: string | string[] | undefined): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return "/";
  // Reject backslashes and control characters before handing the path to Next.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  return value;
}
