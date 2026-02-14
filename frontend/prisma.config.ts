import "dotenv/config";
import path from "path";
import { defineConfig } from "prisma/config";

// Load .env.local if it exists (takes priority over .env)
const dotenv = await import("dotenv");
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    directUrl: process.env["DIRECT_URL"],
  },
});
