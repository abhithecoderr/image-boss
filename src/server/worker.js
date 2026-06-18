// Cloudflare worker server providing auth and cloud inference routes

import { Hono } from 'hono';
import { authRoute } from './routes/auth';
import { predictRoute } from './routes/predict';

const app = new Hono();

app.route('/api/auth', authRoute);
app.route('/api/predict', predictRoute);

export default app;
