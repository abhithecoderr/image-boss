// Handles auth route through betterauth handler

import { Hono } from 'hono';
import { createAuth } from '../middleware/auth';

export const authRoute = new Hono();

// Handles all auth requests under /api/auth.
authRoute.on(['POST', 'GET'], '/*', async (c) => {

  console.log(`[AUTH WORKER] Incoming request: ${c.req.method} ${c.req.url}`);

  const auth = createAuth(c.env);

  try {
    //Reads raw request data to decide what to do
    const res = await auth.handler(c.req.raw);
    console.log(`[AUTH WORKER] Outgoing response: Status ${res.status}`);

    if (res.headers.has('location')) {
      console.log(`[AUTH WORKER] Redirecting to: ${res.headers.get('location')}`);
    }

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      console.log(`[AUTH WORKER] Cookies set: ${setCookie}`);
    }

    return res;
  } catch (err) {
    console.error(`[AUTH WORKER] Unhandled exception:`, err);
    return c.json({ error: err.message }, 500);
  }
});
