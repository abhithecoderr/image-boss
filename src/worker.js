import { Hono } from 'hono';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';

const app = new Hono();

const createAuth = (env) => {
  const db = drizzle(env.DB, { schema });
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || "",
        clientSecret: env.GOOGLE_CLIENT_SECRET || "",
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
  });
};

app.on(['POST', 'GET'], '/api/auth/**', async (c) => {
  console.log(`[AUTH WORKER] Incoming request: ${c.req.method} ${c.req.url}`);
  const auth = createAuth(c.env);
  try {
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
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

export default app;
