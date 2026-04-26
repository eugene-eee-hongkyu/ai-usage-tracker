import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  githubId: text("github_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  apiKeyHash: text("api_key_hash"),
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
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userUniq: uniqueIndex("user_snapshots_user_uniq").on(t.userId),
  })
);
