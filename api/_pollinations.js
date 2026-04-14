export function getPollinationsApiKey() {
  const candidates = [
    process.env.POLLINATIONS_API,
    process.env.POLLINATIONS_API_KEY,
    process.env.NEXT_PUBLIC_POLLINATIONS_API
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return '';
}
