// Enforces middleware checks for session and rate limits
// Checks user and their credits, makes the request url for modal endpoint
// Calculates inference time and deducts credits appropriately

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { checkCredits, calculateCost, deductUserCredits, MODEL_RATES } from '../services/credits';

export const predictRoute = new Hono();

// auth and rate limit enforcer middleware
predictRoute.use('*', requireAuth);
predictRoute.use('*', rateLimit(15, 60000)); // Limit: 15 requests per minute

predictRoute.post('/', async (c) => {
  // 1. Validate payload size (limit: 10MB)
  const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);
  if (contentLength > 10 * 1024 * 1024) {
    return c.json({ error: "Payload too large. Maximum size allowed is 10MB." }, 413);
  }

  const model = c.req.query('model') || '';
  const device = c.req.query('device') || '';
  const user = c.get('user');

  const db = drizzle(c.env.DB, { schema });

  // 2. Fetch current credits balance and verify the user profile exists
  let creditInfo;
  try {
    creditInfo = await checkCredits(db, user.id);
  } catch (err) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 500);
  }

  const { credits, hasCredits, dbUser } = creditInfo;

  if (!hasCredits) {
    return c.json({ error: "Insufficient credits. Please upgrade your plan to process images." }, 402);
  }

  // 3. Determine the runtime API URL based on model config
  let targetBaseUrl = '';
  const rateConfig = MODEL_RATES[model];
  if (rateConfig) {
    targetBaseUrl = rateConfig.type === 'cpu' ? c.env.MODAL_CPU_API_URL : c.env.MODAL_GPU_API_URL;
  }

  if (!targetBaseUrl) {
    console.error(`[PROXY] Unknown model or API not configured for model: ${model}`);
    return c.json({ error: `API URL not configured or unknown model runtime for model ${model}` }, 400);
  }

  try {
    const url = `${targetBaseUrl.replace(/\/$/, '')}/predict?model=${model}&device=${device}&t=${Date.now()}`;
    console.log(`[PROXY] Forwarding request for ${model} to: ${url}`);

    // Build headers, forwarding content-type and setting bearer auth if configured
    const headers = {
      'Content-Type': c.req.header('Content-Type') || 'multipart/form-data'
    };
    if (c.env.VERIFY_MODAL_REQUEST_KEY) {
      headers['Authorization'] = `Bearer ${c.env.VERIFY_MODAL_REQUEST_KEY}`;
    }

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      body: c.req.raw.body,
      headers
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[PROXY] Modal API failed: ${response.status} - ${errText}`);
      return new Response(errText, { status: response.status });
    }

    // 4. Compute elapsed duration and deduct credits
    const duration = (Date.now() - startTime) / 1000;
    const cost = calculateCost(model, duration);
    const newCredits = await deductUserCredits(db, user.id, dbUser, cost);

    console.log(`[CREDITS] User ${user.id} consumed ${cost} credits. Remaining: ${newCredits}`);

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
    return c.json({ error: err.message }, 500);
  }
});
