// Defines model rates and functions to calculate costs, and check/deduct credits
// Server-side registry: maps client model IDs → { api_model_tag, api_runtime }
// The client never sees this mapping — it only sends its own internal model ID.
export const PAID_MODEL_REGISTRY = {
  // Background removal
  'birefnet':                               { api_model_tag: 'birefnet-general', api_runtime: 'cpu' },
  'birefnet-lite':                          { api_model_tag: 'birefnet-lite',    api_runtime: 'cpu' },
  'ben2':                                   { api_model_tag: 'ben2',             api_runtime: 'cpu' },
  // SAM object segmentation (client sends the full ONNX model ID)
  'onnx-community/sam2.1-hiera-tiny-ONNX':  { api_model_tag: 'sam-tiny',         api_runtime: 'cpu' },
  'onnx-community/sam2.1-hiera-small-ONNX': { api_model_tag: 'sam-small',        api_runtime: 'cpu' },
  'onnx-community/sam2.1-hiera-large-ONNX': { api_model_tag: 'sam-large',        api_runtime: 'gpu' },
  // Upscaling
  'esrgan':                                 { api_model_tag: 'esrgan',           api_runtime: 'gpu' },
  // Captioning
  'lfm2.5-vl':                              { api_model_tag: 'lfm2.5-vl',        api_runtime: 'cpu' },
};

import { eq, sql } from 'drizzle-orm';
import * as schema from '../db/schema';

export const MODEL_RATES = {
  'birefnet-lite': { type: 'cpu', rate: 0.05 },
  'birefnet-general': { type: 'cpu', rate: 0.05 },
  'ben2': { type: 'cpu', rate: 0.05 },
  'sam-tiny': { type: 'cpu', rate: 0.05 },
  'sam-small': { type: 'cpu', rate: 0.05 },
  'sam-large': { type: 'gpu', rate: 0.25 },
  'esrgan': { type: 'gpu', rate: 0.5 },
  'lfm2.5-vl': { type: 'cpu', rate: 0.05 },
};

export function getModelRate(model) {
  return MODEL_RATES[model]?.rate ?? 0.05; // Default: 0.05 (CPU)
}

export function calculateCost(model, durationInSeconds) {
  const rate = getModelRate(model);
  // A model explicitly priced at 0 (e.g. Workers AI partner models during a free period)
  // costs nothing — bypass the per-call minimum floor.
  if (rate === 0) return 0;
  return Math.max(1, Math.round(durationInSeconds * rate));
}

// Checks user's database for credits and returns the number of credits
export async function checkCredits(db, userId) {
  const [dbUser] = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  if (!dbUser) {
    throw new Error('User profile not found.');
  }
  return {
    credits: dbUser.credits,
    hasCredits: dbUser.credits > 0,
    dbUser,
  };
}

export async function deductUserCredits(db, userId, dbUser, cost) {
  const [updatedUser] = await db.update(schema.user)
    .set({ credits: sql`MAX(0, credits - ${cost})` })
    .where(eq(schema.user.id, userId))
    .returning({ credits: schema.user.credits });
  return updatedUser?.credits ?? 0;
}

