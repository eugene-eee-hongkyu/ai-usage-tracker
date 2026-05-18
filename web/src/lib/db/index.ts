// db factory — DATABASE_KIND 또는 build-time NEXT_PUBLIC_LOCAL_MODE 로 dialect 분기.
//
// Next.js standalone build 의 worker process 가 spawn env 를 inherit 못 받는 케이스가
// 있어 build-time inline 되는 NEXT_PUBLIC_LOCAL_MODE 도 함께 본다.
//
// db 객체는 lazy Proxy — build 의 page-data 수집 단계가 module-load 시점에
// better-sqlite3 require 하지 않도록 (force-dynamic route 에서 첫 호출 시 init).
// schema 는 eager — column 정의는 native binary 의존 0, drizzle query builder 가
// 직접 객체 trap 을 호출하므로 Proxy 가 무한루프 유발.

import * as pgSchema from "./schema";
import { drizzle as pgDrizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

type Schema = typeof pgSchema;
type Db = NodePgDatabase<Schema>;

const isLocal =
  process.env.DATABASE_KIND === "sqlite" ||
  process.env.NEXT_PUBLIC_LOCAL_MODE === "1";

// schema 는 module load 시점에 결정 (둘 다 native binary 의존 X).
// require 사용 — 빌드 시 isLocal 결정되면 한쪽만 evaluate.
function pickSchema(): Schema {
  if (isLocal) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./schema-sqlite") as unknown as Schema;
  }
  return pgSchema;
}
const schema = pickSchema();

export const users = schema.users;
export const userSnapshots = schema.userSnapshots;
export const periodSnapshots = schema.periodSnapshots;
export const userBlocks = schema.userBlocks;
export const dailyVisits = schema.dailyVisits;

// admin-v1: cloud-only 테이블. type 은 PG schema 직접 import.
// LOCAL_MODE 에서 admin code 호출 시 sqlite 의 "no such table" 에러 발생 — 따라서 admin
// API route 는 IS_LOCAL_MODE 가드로 LOCAL_MODE 진입 차단 필수.
export const invitations = pgSchema.invitations;
export const joinRequests = pgSchema.joinRequests;
export const apiTokens = pgSchema.apiTokens;
export const auditLogs = pgSchema.auditLogs;

// Phase 4.2 (M6a): multi-tenant. teams + team_members 신규.
export const teams = pgSchema.teams;
export const teamMembers = pgSchema.teamMembers;

function makeLocalDb(): Db {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: sqliteDrizzle } = require("drizzle-orm/better-sqlite3");
  const sqlitePath = process.env.SQLITE_PATH ?? "./data.sqlite3";
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqliteDrizzle(sqlite, { schema }) as unknown as Db;
}

function makeRemoteDb(): Db {
  const rawUrl =
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/z21_usage";
  const isLocalPg = rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1");
  const pool = new Pool({
    connectionString: rawUrl,
    ssl: isLocalPg ? false : { rejectUnauthorized: false },
  });
  return pgDrizzle(pool, { schema });
}

// db 는 lazy — 첫 query 호출 시점에 better-sqlite3 native binary load.
// build prerender 단계는 force-dynamic 으로 회피, 그래도 module load 자체에서
// require 가 일어나지 않도록 안전망.
let _db: Db | null = null;
function ensureDb(): Db {
  if (_db) return _db;
  _db = isLocal ? makeLocalDb() : makeRemoteDb();
  return _db;
}

export const db: Db = new Proxy({} as Db, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (ensureDb() as any)[prop];
    return typeof value === "function" ? value.bind(ensureDb()) : value;
  },
}) as Db;

export const IS_LOCAL_MODE = isLocal;
