import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows a separate build output (e.g. NEXT_DIST_DIR=.next-prod) so a
  // production build never disturbs a running `next dev`.
  // Note: the SQLite database lives outside this folder (see src/db/url.ts) so
  // database writes don't trigger the dev file watcher.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@libsql/client", "libsql"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
