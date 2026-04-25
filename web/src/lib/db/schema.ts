import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  githubId: text("github_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  apiKeyHash: text("api_key_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
});

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    sessionIdHash: text("session_id_hash").notNull(),
    project: text("project").notNull().default("unknown"),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheRead: integer("cache_read").notNull().default(0),
    cacheWrite: integer("cache_write").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    oneShotEdits: integer("one_shot_edits").notNull().default(0),
    totalEdits: integer("total_edits").notNull().default(0),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at").notNull(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
    hashUniq: uniqueIndex("sessions_hash_uniq").on(t.userId, t.sessionIdHash),
  })
);

export const dailyAgg = pgTable(
  "daily_agg",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    date: date("date").notNull(),
    totalTokens: integer("total_tokens").notNull().default(0),
    totalCost: real("total_cost").notNull().default(0),
    sessionsCount: integer("sessions_count").notNull().default(0),
    oneShotEdits: integer("one_shot_edits").notNull().default(0),
    totalEdits: integer("total_edits").notNull().default(0),
    cacheRead: integer("cache_read").notNull().default(0),
    cacheWrite: integer("cache_write").notNull().default(0),
  },
  (t) => ({
    userDateUniq: uniqueIndex("daily_agg_user_date_uniq").on(t.userId, t.date),
  })
);

export const suggestionFeedback = pgTable("suggestion_feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  suggestionType: text("suggestion_type").notNull(),
  action: text("action").notNull(), // 'done' | 'dismiss' | 'thumbs_up' | 'thumbs_down'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
