/**
 * Sanitise a user-supplied redirect target (e.g. `?redirect=` on /login and /signup).
 *
 * Only same-origin relative paths are allowed. Anything else, including
 * `javascript:` URLs, protocol-relative `//host`, backslash tricks (`/\host`),
 * absolute URLs and control characters, falls back to `fallback`.
 *
 * The result is safe to pass to `window.location.href`, `router.push` or
 * `NextResponse.redirect(new URL(result, origin))`.
 */
export function safeRedirect(target: string | null | undefined, fallback = '/dashboard'): string {
  if (typeof target !== 'string') return fallback;

  let value = target.trim();
  if (!value) return fallback;

  // Decode once so encoded tricks (%2F%2F, %5C, %09) are judged on what the browser will see.
  try {
    const decoded = decodeURIComponent(value);
    value = decoded;
  } catch {
    return fallback;
  }

  // Control characters (incl. tab/newline, which browsers strip inside URLs) are never legitimate.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  // Must be a root-relative path: "/" followed by something other than "/" or "\".
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (value.includes('\\')) return fallback;

  // Final guard: resolving against a dummy origin must keep that origin.
  try {
    const resolved = new URL(value, 'https://qs.invalid');
    if (resolved.origin !== 'https://qs.invalid') return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
