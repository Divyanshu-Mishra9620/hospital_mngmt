import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { databaseUrl } from "./url";

const url = databaseUrl();

// Re-use one client per database URL across hot reloads in development.
const g = globalThis as unknown as { __medoraDb?: Record<string, Client> };
g.__medoraDb ??= {};
const client = g.__medoraDb[url] ?? createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN, timeout: 5000 });
if (process.env.NODE_ENV !== "production") g.__medoraDb[url] = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
