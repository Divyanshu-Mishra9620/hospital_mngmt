import { defineConfig } from "drizzle-kit";

// Used only to generate SQL migrations from src/db/schema.ts (`npm run db:generate`).
// In local-storage mode the browser database is created from these migrations
// via `npm run schema:client`.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
