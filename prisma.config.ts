import * as dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI reads .env, but Next.js projects store secrets in .env.local.
// Load .env.local so migrate dev / generate can resolve the connection URLs.
dotenv.config({ path: ".env.local" });

// DIRECT_URL (port 5432 on the direct DB host) is blocked by the corporate
// firewall (only IPv6 route). Use a session-mode URL derived from the pooler
// host (port 5432, no pgbouncer param) so the migrate CLI can reach the live
// Supabase DB via the IPv4 pooler endpoint.
const pooled = process.env.DATABASE_URL ?? "";
const migrateUrl = pooled
  .replace(/:6543\//, ":5432/")
  .replace(/[?&]pgbouncer=true/, "")
  .replace(/pgbouncer=true&/, "");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrateUrl,
  },
});
