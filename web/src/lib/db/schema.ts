import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  real,
  timestamp,
  jsonb,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  githubId: text("github_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  apiKeyHash: text("api_key_hash"),
  timezone: text("timezone"),
  // 사용자가 명시한 Claude Code plan tier. 자동 추정과 별도로 본인 입력 받음.
  // null 이면 추정만 사용. 값: 'pro' | 'max5' | 'max20' | 'team' | 'api'
  planTier: text("plan_tier"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
});

export const userSnapshots = pgTable(
  "user_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    rawJson: jsonb("raw_json").notNull(),
    totalCost: real("total_cost").notNull().default(0),
    sessionsCount: integer("sessions_count").notNull().default(0),
    callsCount: integer("calls_count").notNull().default(0),
    cacheHitPct: real("cache_hit_pct").notNull().default(0),
    overallOneShot: real("overall_one_shot").notNull().default(0),
    currentWeekRawJson: jsonb("current_week_raw_json"),
    currentWeekStart: date("current_week_start"),
    currentMonthRawJson: jsonb("current_month_raw_json"),
    currentMonthStart: date("current_month_start"),
    currentDayRawJson: jsonb("current_day_raw_json"),
    currentDayStart: date("current_day_start"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userUniq: uniqueIndex("user_snapshots_user_uniq").on(t.userId),
  })
);

export const periodSnapshots = pgTable(
  "period_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    periodType: text("period_type").notNull(),
    periodStart: date("period_start").notNull(),
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
    rawJson: jsonb("raw_json").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("period_snapshots_uniq").on(t.userId, t.periodType, t.periodStart),
  })
);

// ccusage blocks --json 을 5h 빌링 블록 단위로 누적. wall-clock 분 단위 분석을
// 위한 유일한 데이터 원천 (ccusage daily 는 날짜 기준이라 분 단위 정보 없음).
// gap 블록(isGap=true)·actualEndTime null 인 미종료 active 는 저장하지 않음.
// 동일 block_id 가 재수집되면 ended_at/minutes/totals 를 갱신.
export const userBlocks = pgTable(
  "user_blocks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    blockId: text("block_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    minutes: integer("minutes").notNull(),
    entries: integer("entries").notNull().default(0),
    totalTokens: bigint("total_tokens", { mode: "number" }).notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    models: jsonb("models").notNull().default(sql`'[]'::jsonb`),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userBlockUniq: uniqueIndex("user_blocks_user_block_uniq").on(t.userId, t.blockId),
    userStartedIdx: index("user_blocks_user_started_idx").on(t.userId, t.startedAt),
  })
);

// 사용자가 자기 dashboard 를 본 일자별 횟수. lower bar 가설 ("월 1회 보면
// 성공") 의 직접 측정 + 본인 동기 부여 (visit heatmap 카드).
// /api/visit POST 가 mount-time 1회 호출되어 (user_id, today) 행을 upsert.
// today 는 사용자 timezone 기준 (users.timezone, NULL 이면 UTC).
export const dailyVisits = pgTable(
  "daily_visits",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    date: date("date").notNull(),
    count: integer("count").notNull().default(0),
    totalDwellSeconds: integer("total_dwell_seconds").notNull().default(0),
  },
  (t) => ({
    userDateUniq: uniqueIndex("daily_visits_user_date_uniq").on(t.userId, t.date),
  })
);
