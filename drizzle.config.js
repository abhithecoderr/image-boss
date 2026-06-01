import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.js",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/b64b34fe1f4e24fbba47549a0d8c225aac6b11d3624f15497ec0bf8eab9c5c62.sqlite",
  },
});
