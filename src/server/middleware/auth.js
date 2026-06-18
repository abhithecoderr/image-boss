/* Creates auth instance and provides a requireAuth middleware that creates
   the instance for every request to generate a session id and attach session
   and user info to hono context
*/

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

//auth instance that uses cloudflare environment variables
export const createAuth = (env) => {
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

export const requireAuth = async (c, next) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  });

  if (!session || !session.user) {
    return c.json({ error: "Unauthorized. Please log in to process images." }, 401);
  }

  // Attach session and user to Hono context
  c.set('session', session);
  c.set('user', session.user);

  await next();
};
