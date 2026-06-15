/*
 * Cloudflare Worker backend hosting user auth APIs and predict proxies.
 */
import { Hono } from 'hono';
import { authRoute } from './routes/auth';
import { predictRoute } from './routes/predict';

const app = new Hono();

app.route('/api/auth', authRoute);
app.route('/api/predict', predictRoute);

export default app;
