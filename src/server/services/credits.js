import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';

export const MODEL_RATES = {
  'birefnet-lite': { type: 'cpu', rate: 0.05 },
  'birefnet-general': { type: 'cpu', rate: 0.05 },
  'sam-tiny': { type: 'cpu', rate: 0.05 },
  'sam-small': { type: 'cpu', rate: 0.05 },
  'sam-large': { type: 'gpu', rate: 0.25 },
  'esrgan': { type: 'gpu', rate: 0.5 },
};

export function getModelRate(model) {
  return MODEL_RATES[model]?.rate ?? 0.05; // Default: 0.05 (CPU)
}

export function calculateCost(model, durationInSeconds) {
  const rate = getModelRate(model);
  return Math.max(1, Math.round(durationInSeconds * rate));
}

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
  const newCredits = Math.max(0, dbUser.credits - cost);
  await db.update(schema.user)
    .set({ credits: newCredits })
    .where(eq(schema.user.id, userId));
  return newCredits;
}
