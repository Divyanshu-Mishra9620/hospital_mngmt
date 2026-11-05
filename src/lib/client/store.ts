/**
 * Browser-side database ("local storage mode").
 *
 * The full SQLite schema runs in the browser via sql.js (WebAssembly). The
 * database file is gzip-compressed and saved to localStorage, so data survives
 * reloads, and other tabs of the same browser pick up changes automatically.
 * Demo data is generated on first visit (see ./seed.ts).
 *
 * The original server database (libSQL/Turso) is archived in
 * archive/database-version.zip and in git history.
 */
import { gunzipSync, gzipSync } from "fflate";
import type { Database, SqlJsStatic } from "sql.js";
import { SCHEMA_SQL } from "./schema-sql";

const STORAGE_KEY = "medora.db.v1";
const SEED_KEY = "medora.db.seededAt";

let SQL: SqlJsStatic | null = null;
let sdb: Database | null = null;
let readyPromise: Promise<void> | null = null;
let txDepth = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastWritten: string | null = null;
let dirty = false;

/* ----------------------------------------------------------- change events */

let version = 0;
const listeners = new Set<() => void>();
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getVersion() {
  return version;
}
/** Tell mounted pages that data changed (they re-run their loaders). */
export function bump() {
  version++;
  for (const fn of listeners) fn();
}

/* ------------------------------------------------------------- the database */

export function isReady() {
  return !!sdb;
}

export function getSqlDb(): Database {
  if (!sdb) throw new Error("The local database is still loading.");
  return sdb;
}

export function ready(): Promise<void> {
  if (typeof window === "undefined") return new Promise(() => {}); // never resolves on the server
  return (readyPromise ??= init());
}

async function loadSqlJs() {
  if (SQL) return SQL;
  const initSqlJs = (await import("sql.js")).default;
  SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  return SQL;
}

async function init() {
  const S = await loadSqlJs();
  const saved = await readSaved();
  if (saved) {
    try {
      sdb = new S.Database(saved);
      sdb.exec("SELECT count(*) FROM users"); // sanity check
    } catch {
      sdb = null;
    }
  }
  if (!sdb) await createFresh();
  window.addEventListener("storage", onStorage);
  // Save synchronously before the tab is hidden, reloaded or closed.
  window.addEventListener("pagehide", flushSync);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushSync());
}

async function createFresh() {
  const S = await loadSqlJs();
  sdb?.close();
  sdb = new S.Database();
  dirty = true;
  for (const stmt of SCHEMA_SQL) sdb.run(stmt);
  const { seedDatabase } = await import("./seed");
  beginTx();
  try {
    await seedDatabase();
    commitTx();
  } catch (err) {
    rollbackTx();
    throw err;
  }
  try {
    localStorage.setItem(SEED_KEY, new Date().toISOString());
  } catch {}
  flushSync();
}

/** Wipes everything in this browser and regenerates fresh demo data. */
export async function resetDemoData() {
  await ready();
  await createFresh();
  bump();
}

export function seededAt() {
  try {
    return localStorage.getItem(SEED_KEY);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ transactions */

export function beginTx() {
  const db = getSqlDb();
  txDepth++;
  db.run(txDepth === 1 ? "BEGIN" : `SAVEPOINT sp${txDepth}`);
}
export function commitTx() {
  const db = getSqlDb();
  db.run(txDepth === 1 ? "COMMIT" : `RELEASE sp${txDepth}`);
  txDepth--;
  markDirty();
}
export function rollbackTx() {
  const db = getSqlDb();
  db.run(txDepth === 1 ? "ROLLBACK" : `ROLLBACK TO sp${txDepth}`);
  txDepth--;
}

/* ------------------------------------------------------------- persistence */

/** Schedules a save to localStorage shortly after a write. */
export function markDirty() {
  if (typeof window === "undefined") return;
  dirty = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSync, 250);
}

/** Saves the database to localStorage now (synchronous, so it is safe on unload). */
export function flushSync() {
  if (!sdb || !dirty) return;
  if (txDepth > 0) return markDirty(); // never export mid-transaction (export reopens the db)
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const encoded = encode(sdb.export());
  try {
    localStorage.setItem(STORAGE_KEY, encoded);
    lastWritten = encoded;
    dirty = false;
  } catch (err) {
    console.warn("Could not save the demo database to localStorage", err);
  }
}

async function readSaved(): Promise<Uint8Array | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    lastWritten = raw;
    return decode(raw);
  } catch {
    return null;
  }
}

async function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY || !e.newValue || e.newValue === lastWritten || !SQL) return;
  if (txDepth > 0 || dirty) return; // our own unsaved write wins; it will be saved next
  try {
    const bytes = decode(e.newValue);
    sdb?.close();
    sdb = new SQL.Database(bytes);
    lastWritten = e.newValue;
    bump();
  } catch (err) {
    console.warn("Could not sync the database from another tab", err);
  }
}

/* ------------------------------------------------- gzip + base64 encoding */

function encode(bytes: Uint8Array): string {
  return "gz:" + toBase64(gzipSync(bytes, { level: 6 }));
}

function decode(text: string): Uint8Array {
  if (text.startsWith("gz:")) return gunzipSync(fromBase64(text.slice(3)));
  return fromBase64(text.replace(/^raw:/, ""));
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
