import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows a separate build output (e.g. NEXT_DIST_DIR=.next-prod) so a
  // production build never disturbs a running `next dev`.
  // Local-storage mode: the app's SQLite database runs in the browser (sql.js,
  // see src/lib/client/store.ts); there is no server database.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
