import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  driver: "libsql",
  dbCredentials: {
    url: `file:${process.env.DATABASE_PATH ?? "./data/scorecard.db"}`,
  },
} satisfies Config;
