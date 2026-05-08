import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  githubId: text("github_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  apiKeyHash: text("api_key_hash"),
  timezone: text("timezone"),
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
