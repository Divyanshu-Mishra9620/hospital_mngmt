/**
 * Database handle — LOCAL STORAGE MODE.
 *
 * `db` is a Drizzle instance over an in-browser SQLite database (sql.js) that
 * is saved to localStorage (see src/lib/client/store.ts). All queries in the
 * app run in the browser. The server database version (libSQL / Turso) is
 * archived in archive/database-version.zip and in git history — restore it by
 * switching this file back to the drizzle-orm/libsql client.
 */
import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import type { Database } from "sql.js";
import * as schema from "./schema";
import { beginTx, commitTx, getSqlDb, markDirty, rollbackTx } from "@/lib/client/store";

type Drizzle = SQLJsDatabase<typeof schema>;

let current: { raw: Database; db: Drizzle } | null = null;
function real(): Drizzle {
  const raw = getSqlDb();
  if (!current || current.raw !== raw) current = { raw, db: drizzle(raw, { schema }) };
  return current.db;
}

const WRITES = new Set(["insert", "update", "delete", "run"]);

/** Async-safe transaction (sql.js is synchronous; app code awaits inside). */
async function transaction<T>(fn: (tx: Drizzle) => Promise<T> | T): Promise<T> {
  beginTx();
  try {
    const result = await fn(db);
    commitTx();
    return result;
  } catch (err) {
    rollbackTx();
    throw err;
  }
}

export const db: Drizzle = new Proxy({} as Drizzle, {
  get(_t, prop) {
    if (prop === "transaction") return transaction;
    const target = real();
    if (typeof prop === "string" && WRITES.has(prop)) markDirty();
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
