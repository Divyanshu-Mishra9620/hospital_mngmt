import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Database location.
 *
 * DATABASE_URL wins when set (e.g. a Turso `libsql://…` URL in production, or
 * `file:./somewhere.db`). Otherwise the local SQLite file lives OUTSIDE the
 * project folder, in ~/.medora-hospital/. Keeping it out of the project matters:
 * `next dev` watches every file in the project, and the stream of writes to the
 * SQLite WAL file would otherwise trigger constant rebuilds and can crash
 * Turbopack during bulk writes such as `npm run db:seed`.
 */
export function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const dir = join(homedir(), ".medora-hospital");
  mkdirSync(dir, { recursive: true });
  return "file:" + join(dir, "medora.db").split("\\").join("/");
}
