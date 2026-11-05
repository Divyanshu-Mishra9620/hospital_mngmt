// Regenerates src/lib/client/schema-sql.ts from the Drizzle migration (run after `npm run db:generate`).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const files = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort();
const stmts = files.flatMap((f) => readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean));
writeFileSync(
  "src/lib/client/schema-sql.ts",
  `// Generated from drizzle/*.sql — the schema the in-browser SQLite database is created with.\n// Regenerate after changing src/db/schema.ts: npm run db:generate && npm run schema:client\nexport const SCHEMA_SQL: string[] = ${JSON.stringify(stmts, null, 1)};\n`,
);
console.log(`${stmts.length} statements from ${files.length} migration(s)`);
