// Enforces middleware checks for session and rate limits
// Checks user and their credits, makes the request url for modal endpoint
// Calculates inference time and deducts credits appropriately

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { checkCredits, calculateCost, deductUserCredits, MODEL_RATES, PAID_MODEL_REGISTRY } from '../services/credits';

export const predictRoute = new Hono();

// auth and rate limit enforcer middleware
predictRoute.use('*', requireAuth);
predictRoute.use('*', rateLimit()); 

predictRoute.get('/permissions', async (c) => {
  const user = c.get('user');
  const allowedPaidEmailsStr = c.env.ALLOWED_PAID_EMAILS || '';
  const allowedPaidEmails = allowedPaidEmailsStr.split(',').map(e => e.trim().toLowerCase());
  const hasPaidAccess = user && user.email && (
    user.email.toLowerCase() === "abhicooltripathi1@gmail.com" ||
    allowedPaidEmails.includes(user.email.toLowerCase())
  );
  return c.json({ hasPaidAccess: !!hasPaidAccess });
});

predictRoute.post('/', async (c) => {
  // 1. Validate payload size (limit: 10MB)
  const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);
  if (contentLength > 10 * 1024 * 1024) {
    return c.json({ error: "Payload too large. Maximum size allowed is 10MB." }, 413);
  }

  // Client sends its own internal model ID (e.g. 'birefnet-lite', 'esrgan').
  // The server resolves the API tag and compute runtime — never trusting client-supplied device.
  const clientModelId = c.req.query('model') || '';
  const user = c.get('user');

  // Security Guard: Limit access to paid cloud models during development/testing phase
  const allowedPaidEmailsStr = c.env.ALLOWED_PAID_EMAILS || '';
  const allowedPaidEmails = allowedPaidEmailsStr.split(',').map(e => e.trim().toLowerCase());
  if (!user || !user.email || !allowedPaidEmails.includes(user.email.toLowerCase())) {
    console.warn(`[PROXY] Unauthorized access attempt to paid model '${clientModelId}' by user ${user?.email || 'unknown'}`);
    return c.json({ error: "Access denied. Paid cloud models are currently restricted to authorized testers." }, 403);
  }

  // 2. Resolve client model ID → API tag + runtime via server-side registry
  const registryEntry = PAID_MODEL_REGISTRY[clientModelId];
  if (!registryEntry) {

    console.error(`[PROXY] Unknown or non-paid model requested: ${clientModelId}`);
    return c.json({ error: `Unknown model: ${clientModelId}` }, 400);
  }

  const { api_model_tag: model, api_runtime: device } = registryEntry;

  // 3. Validate the resolved API tag has a rate config
  const rateConfig = MODEL_RATES[model];
  if (!rateConfig) {
    console.error(`[PROXY] No rate config for resolved model tag: ${model}`);
    return c.json({ error: `Model not configured for billing: ${model}` }, 500);
  }

  const db = drizzle(c.env.DB, { schema });

  // 4. Fetch current credits balance and verify the user profile exists
  let creditInfo;
  try {
    creditInfo = await checkCredits(db, user.id);
  } catch (err) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 500);
  }

  const { credits, dbUser } = creditInfo;

  // Enforce a model-specific minimum credit threshold (5 for GPU models, 1 for CPU models).
  // Models priced at rate 0 (e.g. free Workers AI partner models) bypass this entirely.
  const minRequiredCredits = rateConfig.rate === 0 ? 0
    : rateConfig.type === 'gpu' ? 5 : 1;
  if (credits < minRequiredCredits) {
    return c.json({
      error: `Insufficient credits. Operating ${model} requires a minimum balance of ${minRequiredCredits} credits. Current balance: ${credits}.`
    }, 402);
  }

  // 5. Branch on runtime: cf-ai runs in-process via the Workers AI binding,
  //    everything else (cpu/gpu) is proxied to the Modal inference endpoint.
  // Determine the runtime API URL based on resolved runtime (not client-supplied)
  let targetBaseUrl = device === 'cpu' ? c.env.MODAL_CPU_API_URL : c.env.MODAL_GPU_API_URL;

  if (!targetBaseUrl) {
    console.error(`[PROXY] API URL not configured for runtime: ${device}`);
    return c.json({ error: `API URL not configured for model runtime of ${model}` }, 400);
  }

  try {
    // Parse incoming multipart body on the server
    const parsedBody = await c.req.parseBody();
    const file = parsedBody.file;

    if (!file) {
      return c.json({ error: "Missing file payload in request" }, 400);
    }

    let url = `${targetBaseUrl.replace(/\/$/, '')}/predict?model=${model}&device=${device}&t=${Date.now()}`;
    
    // Append SAM coordinate prompts to the query parameters since the Modal FastAPI server expects them there
    if (parsedBody.point_coords) {
      url += `&point_coords=${encodeURIComponent(parsedBody.point_coords)}`;
    }
    if (parsedBody.point_labels) {
      url += `&point_labels=${encodeURIComponent(parsedBody.point_labels)}`;
    }

    console.log(`[PROXY] Forwarding request for ${clientModelId} → ${model} (${device}) to: ${url}`);
    // Reconstruct clean FormData payload

    const formData = new FormData();
    formData.append('file', file);
    
    // Forward optional parameters if present (model, device, points, labels)
    if (parsedBody.model) formData.append('model', parsedBody.model);
    if (parsedBody.device) formData.append('device', parsedBody.device);
    if (parsedBody.output_type) formData.append('output_type', parsedBody.output_type);
    if (parsedBody.point_coords) formData.append('point_coords', parsedBody.point_coords);
    if (parsedBody.point_labels) formData.append('point_labels', parsedBody.point_labels);

    const headers = {};
    if (c.env.VERIFY_MODAL_REQUEST_KEY) {
      headers['Authorization'] = `Bearer ${c.env.VERIFY_MODAL_REQUEST_KEY}`;
    }

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[PROXY] Modal API failed: ${response.status} - ${errText}`);
      return new Response(errText, { status: response.status });
    }

    // 6. Compute elapsed duration and deduct credits
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
