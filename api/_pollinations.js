/**
 * Resolves the Pollinations API key using the shared fallback order used by
 * generation handlers: POLLINATIONS_API -> POLLINATIONS_API_KEY ->
 * NEXT_PUBLIC_POLLINATIONS_API. Values are trimmed to avoid auth failures
 * caused by accidental leading/trailing whitespace in env configuration.
 */
export function getPollinationsApiKey() {
  const candidates = [
    process.env.POLLINATIONS_API,
    process.env.POLLINATIONS_API_KEY,
    process.env.NEXT_PUBLIC_POLLINATIONS_API
  ];

  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }

  return null;
}
