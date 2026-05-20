// SQLite schema mirror of schema.ts — 로컬 단독 모드 (.pkg/.msi 인스톨러) 용.
// Drizzle 은 pg / sqlite 의 column type 정의가 다르기 때문에 schema 두 벌이 필요하다.
// 비즈니스 로직 (promote / retention) 은 dialect 무관한 onConflictDoUpdate /
// onConflictDoNothing / SQL builder 로 작성되어 있어 코드 분기는 db client 한 곳만.
//
// Postgres → SQLite 매핑 원칙:
//   pgTable      → sqliteTable
//   serial PK    → integer({mode:"number"}).primaryKey({autoIncrement:true})
//   integer      → integer({mode:"number"})
//   bigint       → integer({mode:"number"}) — JS number 범위 (~9e15) 까지 안전
//   real         → real
//   text         → text
//   timestamp    → integer({mode:"timestamp_ms"}) — ms epoch 저장
//   date         → text — YYYY-MM-DD 문자열 그대로 (이미 코드가 이렇게 쓰고 있음)
//   jsonb        → text({mode:"json"})

import {
  sqliteTable,
  integer,
  real,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// admin-v1 의 role/permissions/suspended_at/deleted_at 컬럼은 LOCAL_MODE 에서도
// schema 일관성 위해 보유. 단 LOCAL_MODE 는 1인용이라 사실상 row 1개 + role='admin'
// 고정. invitations/join_requests/audit_logs/api_tokens 테이블은 cloud 전용이라
// SQLite 에 추가 안 함 (admin UI 자체가 LOCAL_MODE 에서 hidden).
//
// Phase 4.2 (M6a/c) — multi-tenant 도입. teams + team_members 신설.
// LOCAL_MODE 는 single-user 라 사실상 team 1개 ("Local", id=1) 고정. 다만 schema
// 일관성 + 코드 분기 최소화 위해 PG schema 와 동등하게 보유.
//
// SQLite 마이그: drizzle-sqlite/0002_multi_tenant.sql + 0003_audit_platform_flag.sql.
// timestamp_ms (ms epoch) 모드 그대로 — created_at 등 PG 의 timestamp 와 등가.
export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  githubId: text("github_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  apiKeyHash: text("api_key_hash"),
  timezone: text("timezone"),
  planTier: text("plan_tier"),
  role: text("role").notNull().default("member"),
  permissions: text("permissions", { mode: "json" }).notNull().default(sql`'{}'`),
  suspendedAt: integer("suspended_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
});

// Phase 4.2 M6a — teams + team_members. LOCAL_MODE 는 single-team ("Local", id=1).
export const teams = sqliteTable(
  "teams",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownerId: integer("owner_id", { mode: "number" }).notNull(),
    namePending: integer("name_pending", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    slugUniq: uniqueIndex("teams_slug_uniq").on(t.slug),
    ownerIdx: index("teams_owner_idx").on(t.ownerId),
  })
);

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    teamId: integer("team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id),
    userId: integer("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("member"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    teamUserUniq: uniqueIndex("team_members_team_user_uniq").on(t.teamId, t.userId),
    userIdx: index("team_members_user_idx").on(t.userId),
  })
);

export const userSnapshots = sqliteTable(
  "user_snapshots",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: integer("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    teamId: integer("team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id),
    rawJson: text("raw_json", { mode: "json" }).notNull(),
    totalCost: real("total_cost").notNull().default(0),
    sessionsCount: integer("sessions_count", { mode: "number" }).notNull().default(0),
    callsCount: integer("calls_count", { mode: "number" }).notNull().default(0),
    cacheHitPct: real("cache_hit_pct").notNull().default(0),
    overallOneShot: real("overall_one_shot").notNull().default(0),
    currentWeekRawJson: text("current_week_raw_json", { mode: "json" }),
    currentWeekStart: text("current_week_start"),
    currentMonthRawJson: text("current_month_raw_json", { mode: "json" }),
    currentMonthStart: text("current_month_start"),
    currentDayRawJson: text("current_day_raw_json", { mode: "json" }),
    currentDayStart: text("current_day_start"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userTeamUniq: uniqueIndex("user_snapshots_user_team_uniq").on(t.userId, t.teamId),
    teamIdx: index("user_snapshots_team_idx").on(t.teamId),
  })
);

export const periodSnapshots = sqliteTable(
  "period_snapshots",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: integer("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    teamId: integer("team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id),
    periodType: text("period_type").notNull(),
    periodStart: text("period_start").notNull(),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    rawJson: text("raw_json", { mode: "json" }).notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("period_snapshots_uniq").on(t.userId, t.teamId, t.periodType, t.periodStart),
    teamIdx: index("period_snapshots_team_idx").on(t.teamId),
  })
);

export const userBlocks = sqliteTable(
  "user_blocks",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: integer("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    teamId: integer("team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id),
    blockId: text("block_id").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }).notNull(),
    minutes: integer("minutes", { mode: "number" }).notNull(),
    entries: integer("entries", { mode: "number" }).notNull().default(0),
    totalTokens: integer("total_tokens", { mode: "number" }).notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    models: text("models", { mode: "json" }).notNull().default(sql`'[]'`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userTeamBlockUniq: uniqueIndex("user_blocks_user_team_block_uniq").on(t.userId, t.teamId, t.blockId),
    userStartedIdx: index("user_blocks_user_started_idx").on(t.userId, t.startedAt),
    teamIdx: index("user_blocks_team_idx").on(t.teamId),
  })
);

export const dailyVisits = sqliteTable(
  "daily_visits",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: integer("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    teamId: integer("team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id),
    date: text("date").notNull(),
    count: integer("count", { mode: "number" }).notNull().default(0),
    totalDwellSeconds: integer("total_dwell_seconds", { mode: "number" }).notNull().default(0),
  },
  (t) => ({
    userTeamDateUniq: uniqueIndex("daily_visits_user_team_date_uniq").on(t.userId, t.teamId, t.date),
    teamIdx: index("daily_visits_team_idx").on(t.teamId),
  })
);
