/* Rate limiting backed by the native Cloudflare Workers Rate Limiting API.
   Limit and period are configured via the `API_LIMITER` binding in wrangler.json
*/

export function rateLimit() {
  return async (c, next) => {
    const limiter = c.env?.API_LIMITER;

    // Degrade gracefully to "allow" if the binding isn't present (e.g. local dev).
    if (!limiter || typeof limiter.limit !== 'function') {
      console.warn('[RATE LIMIT] API_LIMITER binding missing — skipping check.');
      await next();
      return;
    }

    const ip = c.req.header('CF-Connecting-IP') || 'unknown';

    const { success } = await limiter.limit({ key: ip });

    if (!success) {
      return c.json(
        {
          error: 'Too many requests',
          message: 'You have exceeded your rate limit. Please try again in a minute.',
        },
        429,
        {
          'Retry-After': '60',
          'X-RateLimit-Limit': '30',
        }
      );
    }

    await next();
  };
}
