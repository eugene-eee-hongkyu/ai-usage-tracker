// drizzle-kit SQLite config — 로컬 단독 모드 schema 기반 migration 생성.
// 사용: npx drizzle-kit generate --config=drizzle.sqlite.config.ts
//      npx drizzle-kit push --config=drizzle.sqlite.config.ts   (개발용 직접 적용)

import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema-sqlite.ts",
  out: "./drizzle-sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SQLITE_PATH ?? "./data.sqlite3",
  },
} satisfies Config;
