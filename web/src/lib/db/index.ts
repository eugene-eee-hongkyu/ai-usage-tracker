// db factory — DATABASE_KIND 환경변수로 dialect 분기.
//
//   DATABASE_KIND=sqlite  → 로컬 단독 모드 (.pkg/.msi 인스톨러).
//                           SQLITE_PATH (기본 ./data.sqlite3) 에 better-sqlite3 로 연결.
//                           WAL 모드로 read/write 동시성 안전.
//   그 외 (기본)          → Postgres (Vercel + Supabase).
//
// 타입은 항상 pg schema 기준으로 통일 — drizzle 의 query builder API 가 dialect
// 무관하게 동일하므로 runtime 만 분기해도 정상 작동. sqlite schema 의 column 정의는
// 같은 이름·타입이라 캐스팅으로 호환된다.
//
// 주의: better-sqlite3 는 native binary 라 Vercel 빌드 시 webpack 에 잡히면 안 된다.
// next.config 의 serverExternalPackages 에 등록하고, require 는 동적으로 호출.

import * as pgSchema from "./schema";
import { drizzle as pgDrizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

type Schema = typeof pgSchema;
type Db = NodePgDatabase<Schema>;

const isLocal = process.env.DATABASE_KIND === "sqlite";

function makeLocal(): { db: Db; schema: Schema } {
  // 동적 require — Vercel 빌드 시 정적 분석에 잡히지 않게.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: sqliteDrizzle } = require("drizzle-orm/better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqliteSchema = require("./schema-sqlite");
  const sqlitePath = process.env.SQLITE_PATH ?? "./data.sqlite3";
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return {
    db: sqliteDrizzle(sqlite, { schema: sqliteSchema }) as unknown as Db,
    schema: sqliteSchema as unknown as Schema,
  };
}

function makeRemote(): { db: Db; schema: Schema } {
  const rawUrl =
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/primus_usage";
  const isLocalPg = rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1");
  const pool = new Pool({
    connectionString: rawUrl,
    ssl: isLocalPg ? false : { rejectUnauthorized: false },
  });
  return { db: pgDrizzle(pool, { schema: pgSchema }), schema: pgSchema };
}

const { db: _db, schema: _schema } = isLocal ? makeLocal() : makeRemote();

export const db: Db = _db;
export const users = _schema.users;
export const userSnapshots = _schema.userSnapshots;
export const periodSnapshots = _schema.periodSnapshots;
export const userBlocks = _schema.userBlocks;
export const dailyVisits = _schema.dailyVisits;

// 환경 정보 — auth bypass / single-user 분기 등에서 사용.
export const IS_LOCAL_MODE = isLocal;
