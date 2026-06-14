/*
 * Cloudflare Worker backend hosting user auth APIs and predict proxies.
 */
import { Hono } from 'hono';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
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
    user: {
      additionalFields: {
        credits: {
          type: "number",
        },
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

app.post('/api/predict', async (c) => {
  const model = c.req.query('model') || '';
  const device = c.req.query('device') || '';

  // 1. Authenticate user session
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  });

  if (!session || !session.user) {
    return new Response(JSON.stringify({ error: "Unauthorized. Please log in to process images." }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const userId = session.user.id;
  const db = drizzle(c.env.DB, { schema });

  // 2. Fetch current credits balance
  const [dbUser] = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  if (!dbUser) {
    return new Response(JSON.stringify({ error: "User profile not found." }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (dbUser.credits <= 0) {
    return new Response(JSON.stringify({ error: "Insufficient credits. Please upgrade your plan to process images." }), {
      status: 402,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let targetBaseUrl = '';
  let rate = 0.05; // Credits per second (default: 1 credit per 20 seconds)

  // CPU-based models: birefnet-lite, birefnet-general, sam-tiny, sam-small
  if (['birefnet-lite', 'birefnet-general', 'sam-tiny', 'sam-small'].includes(model)) {
    targetBaseUrl = c.env.MODAL_CPU_API_URL;
    rate = 0.05; // 1 credit per 20 seconds (0.05 credits/sec)
  } 
  // GPU-based models: sam-large, esrgan
  else if (['sam-large', 'esrgan'].includes(model)) {
    if (model === 'esrgan') {
      targetBaseUrl = c.env.MODAL_GPU_API_URL;
      rate = 0.5; // 1 credit per 2 seconds (0.5 credits/sec)
    } else {
      targetBaseUrl = c.env.MODAL_GPU_API_URL;
      rate = 0.25; // 1 credit per 4 seconds (0.25 credits/sec)
    }
  }

  if (!targetBaseUrl) {
    console.error(`[PROXY] Unknown model or API not configured for model: ${model}`);
    return new Response(JSON.stringify({ error: `API URL not configured or unknown model runtime for model ${model}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = `${targetBaseUrl.replace(/\/$/, '')}/predict?model=${model}&device=${device}&t=${Date.now()}`;
    console.log(`[PROXY] Forwarding request for ${model} to: ${url}`);

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      body: c.req.raw.body,
      headers: {
        'Content-Type': c.req.header('Content-Type') || 'multipart/form-data'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[PROXY] Modal API failed: ${response.status} - ${errText}`);
      return new Response(errText, { status: response.status });
    }

    // 3. Compute elapsed duration and deduct credits
    const duration = (Date.now() - startTime) / 1000;
    const cost = Math.max(1, Math.round(duration * rate));
    const newCredits = Math.max(0, dbUser.credits - cost);

    await db.update(schema.user)
      .set({ credits: newCredits })
      .where(eq(schema.user.id, userId));

    console.log(`[CREDITS] User ${userId} consumed ${cost} credits. Remaining: ${newCredits}`);

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/png',
        'X-Credits-Used': String(cost),
        'X-Credits-Remaining': String(newCredits),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (err) {
    console.error(`[PROXY] Unhandled proxy error:`, err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

export default app;

