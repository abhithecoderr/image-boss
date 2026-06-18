const ipRequests = new Map();

export function rateLimit(limit = 15, windowMs = 60000) {
  return async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
    const now = Date.now();

    if (!ipRequests.has(ip)) {
      ipRequests.set(ip, []);
    }

    const timestamps = ipRequests.get(ip);
    // Filter out timestamps outside the sliding window
    const activeTimestamps = timestamps.filter(t => now - t < windowMs);

    if (activeTimestamps.length >= limit) {
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }

    // Add current timestamp and store
    activeTimestamps.push(now);
    ipRequests.set(ip, activeTimestamps);

    await next();
  };
}
