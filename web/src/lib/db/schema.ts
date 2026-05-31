import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  real,
  timestamp,
  jsonb,
  date,
  uniqueIndex,
  index,
  inet,
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
  // 보안 감사 (2026-05-28, H1 temp Option A): 최초 가입 OAuth provider 영구 기록.
  // signIn callback 이 기존 user 매칭 시 provider 가 다르면 reject — GitHub
  // unverified primary email 로 Google 사용자 행 탈취 차단. 옛 사용자는 NULL
  // (legacy fallback 1회 backfill 로 채움). Phase 4.2 의 정식 Account 모델 (옵션 B)
  // 도입 전까지 임시 가드.
  provider: text("provider"),
  // Claude Code plan tier — 사용자 입력. 미입력은 modal 강제 (2026-05-30 자동 추정 폐기).
  // 값: 'pro' | 'max5' | 'max20' | 'team_standard' | 'team_premium' | 'team' | 'api'
  planTier: text("plan_tier"),
  // Codex (OpenAI) plan tier — 사용자 입력. Claude 와 독립.
  // 값: 'free' | 'plus' | 'business' | 'pro' | 'team' | 'enterprise' | 'api'
  codexPlanTier: text("codex_plan_tier"),
  // admin-v1 (Phase 4.1) — 권한 + 라이프사이클.
  //   role: 'member' (default) | 'admin'. Owner 는 ADMIN_EMAIL env 화이트리스트 기반 (별도).
  //   permissions: { membershipAdmin: bool, billingAdmin: bool } JSON — 권한 분리 (Goodhart 회피).
  //   suspendedAt: 정지 시각. NULL 이면 활성.
  //   deletedAt: soft delete. 30일 grace period 동안 복구 가능.
  role: text("role").notNull().default("member"),
  permissions: jsonb("permissions").notNull().default(sql`'{}'::jsonb`),
  suspendedAt: timestamp("suspended_at"),
  deletedAt: timestamp("deleted_at"),
  // Personal 기능 (2026-05-28): true 면 전체 랭킹 참여 (opt-in).
  // 신규 personal-only 가입자 = true. 기존 팀 사용자 = false (opt-in 전까지).
  personal: boolean("personal").notNull().default(false),
  // 어드민이 랭킹에서 숨기는 플래그 (abuse 방어).
  rankingHidden: boolean("ranking_hidden").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
});

// Phase 4.2 (M6a) — multi-tenant 도입. teams + team_members 신설.
//
// 설계:
//   - users 자체는 team_id 컬럼 없음 (한 user 가 N팀 가입 가능 — team_members 가 N:N 매핑)
//   - 데이터 테이블 (user_snapshots 등) 은 team_id FK 보유 → RLS team-scoped 가능
//   - 현재 보고 있는 팀 = session.user.currentTeamId (cookie/URL 추후 결정, M6a 에선 first team)
//
// teams:
//   - name: 사용자 입력 (Slack 패턴). 도메인 무관, 자유 텍스트
//   - slug: URL-safe (예: "iskra-world"). unique
//   - ownerId: 최초 생성자. role 'owner' 와 별개로 빠른 lookup
//   - deletedAt: 30일 grace soft delete (팀 단위)
export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id),
    // Phase 4.2 (M6d): 어드민이 회사명을 직접 정하기 전 임시 상태.
    // true 면 가입 후 /onboard-team 으로 강제 redirect 되어 회사명 입력 받음.
    // 기본 false — 기존 팀과 명시적으로 teamName 받은 신규 팀은 false.
    namePending: boolean("name_pending").notNull().default(false),
    // M6f (2026-05-21): 자동 가입 도메인 목록. owner 가 OAuth 가입한 시점의 email
    // 도메인이 자동 등록 (public domain 블랙리스트 제외). 외부 admin UI 에서 추가
    // 안 함 — single source of truth = owner OAuth 도메인.
    autoJoinDomains: jsonb("auto_join_domains").notNull().default(sql`'[]'::jsonb`),
    // M6g (2026-05-21): 자동 가입 toggle. false 면 도메인 매칭 무시 + /join 으로.
    // Team Owner 또는 Platform Admin 만 변경 가능.
    autoJoinEnabled: boolean("auto_join_enabled").notNull().default(true),
    // 2026-05-22: 회사별 활성 멤버 수 cap. auth.ts auto-join + invitations POST
    // 에서 가드. Platform Admin 만 변경 (PATCH /api/admin/teams/[id]).
    maxMembers: integer("max_members").notNull().default(5),
    // Personal 기능 (2026-05-28): 'normal' (기존 회사팀) | 'personal' (글로벌 personal 팀).
    type: text("type").notNull().default("normal"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    slugUniq: uniqueIndex("teams_slug_uniq").on(t.slug),
    ownerIdx: index("teams_owner_idx").on(t.ownerId),
  })
);

// team_members: user × team N:N 매핑.
//   - role: 'owner' (env ADMIN_EMAIL 와 별개 — 팀별 소유자) | 'admin' | 'member'
//   - deletedAt: 탈퇴 (history 보존, hard delete 안 함)
export const teamMembers = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    teamUserUniq: uniqueIndex("team_members_team_user_uniq").on(t.teamId, t.userId),
    userIdx: index("team_members_user_idx").on(t.userId),
  })
);

// admin-v1: 이메일 초대.
// 어드민이 email + 권한 지정 → token 발급 → Resend 로 발송 → 사용자가 OAuth 통과
// + token 확인 시 즉시 가입. 7일 expire, 재초대/취소 지원.
export const invitations = pgTable(
  "invitations",
  {
    id: serial("id").primaryKey(),
    // Phase 4.2: 어느 팀에 초대하는지. M6a backfill 시 모든 기존 invitations → iskra.world (team_id=1).
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    email: text("email").notNull(),
    invitedBy: integer("invited_by")
      .notNull()
      .references(() => users.id),
    token: text("token").notNull(),
    role: text("role").notNull().default("member"),
    permissions: jsonb("permissions").notNull().default(sql`'{}'::jsonb`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at"),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tokenUniq: uniqueIndex("invitations_token_uniq").on(t.token),
    pendingByEmailIdx: index("invitations_pending_email_idx").on(t.email),
    teamIdx: index("invitations_team_idx").on(t.teamId),
  })
);

// admin-v1: 가입 신청.
// 사용자가 OAuth 통과 후 (initial 가입 아닌) /join 페이지에서 사유 입력.
// 어드민이 approve/reject. 상태 'pending' | 'approved' | 'rejected'.
export const joinRequests = pgTable(
  "join_requests",
  {
    id: serial("id").primaryKey(),
    // Phase 4.2: 가입 신청한 팀. M6a backfill 시 모든 기존 join_requests → iskra.world.
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    userId: integer("user_id").references(() => users.id),
    email: text("email").notNull(),
    teamNameHint: text("team_name_hint"),  // 옛 컬럼 — Phase 4.2 이후 deprecated, M6b 에서 정리
    message: text("message"),
    status: text("status").notNull().default("pending"),
    decidedBy: integer("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at"),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("join_requests_status_idx").on(t.status),
    teamIdx: index("join_requests_team_idx").on(t.teamId),
  })
);

// admin-v1: API 토큰.
// CLI sync 등 자동화용 토큰. 사용자가 본인 또는 admin 이 발급/회수.
// scopes 는 향후 fine-grained 권한용 (현재는 ['ingest', 'read']).
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: serial("id").primaryKey(),
    // Phase 4.2: 어느 팀에 ingest 할지. M6a backfill 시 user 의 첫 team_members.team_id 로 채움.
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    hash: text("hash").notNull(),
    scopes: jsonb("scopes").notNull().default(sql`'[]'::jsonb`),
    // M6e (2026-05-21): device-scope 진단 정보. CLI 가 매 ingest 시 envInfo 보내면
    // 서버가 이 컬럼 UPDATE. 운영 디버그용 (OS / arch / cliVersion / claudeCodeVersion
    // / hookEnabled / lastError / installMethod 등).
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    hashUniq: uniqueIndex("api_tokens_hash_uniq").on(t.hash),
    teamIdx: index("api_tokens_team_idx").on(t.teamId),
  })
);

// admin-v1: 감사 로그 (hash chain immutability).
//
// 방어 layer 3중 (Postgres migration 에서 정의):
//   1. INSERT trigger: prev_hash + row_hash sha256 자동 계산 (advisory lock 으로 직렬화)
//   2. RLS deny update/delete: app role 의 UPDATE/DELETE policy 자체가 false
//   3. REVOKE update/delete on app/anon/authenticated role
//
// 검증: verify_audit_chain() 함수가 ID 순회하며 hash 재계산. 깨진 첫 row 반환.
// admin/audit 페이지 진입 시 자동 호출 (cron 없음 — 사용자 결정 2026-05-18).
//
// actor_type:
//   'user'    — 사람이 admin UI 에서 액션
//   'service' — automated job (이건 보통 별도 sync_log, audit 엔 안 들어옴)
//   'system'  — migration / cron / 자동 expire 등
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    prevHash: text("prev_hash"),
    rowHash: text("row_hash").notNull(),
    // Phase 4.2: 어느 팀의 audit 인지. immutability 정책 (RLS deny update/delete) 유지.
    // M6a backfill 시 모든 기존 행 → iskra.world (team_id=1).
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    actorUserId: integer("actor_user_id").references(() => users.id),
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: integer("target_id"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    ip: inet("ip"),
    // Phase 4.2 M6c: platform owner 의 view-as 모드에서 발생한 액션 표시.
    // hash chain 에는 포함 안 됨 (별도 SET 으로 추가 — 마이그 0006).
    actorIsPlatformOwner: boolean("actor_is_platform_owner").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    actorIdx: index("audit_logs_actor_idx").on(t.actorUserId),
    actionIdx: index("audit_logs_action_idx").on(t.action),
    createdAtIdx: index("audit_logs_created_at_idx").on(t.createdAt),
    teamIdx: index("audit_logs_team_idx").on(t.teamId),
    platformIdx: index("audit_logs_platform_idx").on(t.actorIsPlatformOwner),
  })
);

export const userSnapshots = pgTable(
  "user_snapshots",
  {
    id: serial("id").primaryKey(),
    // Phase 4.2: 어느 팀의 snapshot. M6a backfill 시 user 의 team_members.team_id 로 채움.
    // user 가 N팀 가입 시 같은 user 가 N row (team 별 snapshot 분리).
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    // M6f (2026-05-25): device-scope snapshot. (user_id, team_id, token_id) 가 row 식별.
    // 같은 user 의 노트북 N대가 각자 row 1개씩 보유. dashboard 는 device 선택.
    // nullable: fallback (users.api_key_hash 매칭) 경로에서 token 결정 못 했을 때만.
    // 안정화 (1-2주) 후 NOT NULL 강제 + COALESCE 인덱스 → 정상 인덱스 재구성 예정.
    tokenId: integer("token_id").references(() => apiTokens.id),
    // Multi-provider (2026-05-29 M): Claude / Codex (/ Phase 2 Gemini 등) 분리.
    // ccusage / codeburn 양쪽이 단일 binary 로 모든 provider 지원 → provider 별
    // 분리 호출 + (user, team, token, provider) 단위 row. 기존 row 는 default
    // 'claude' 로 자동 마킹 (마이그 0016).
    provider: text("provider").notNull().default("claude"),
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
    // 실제 DB unique index = (user_id, team_id, token_id, provider) NULLS NOT
    // DISTINCT (PG 15+). NULL token_id 끼리도 같은 값으로 취급해 legacy fallback
    // row 중복 차단. drizzle ON CONFLICT (column-list) 와 호환. drizzle migrate
    // 는 미사용 — 마이그 파일 (drizzle/*.sql) 을 수동으로 Supabase 에 적용.
    userTeamTokenProviderUniq: uniqueIndex("user_snapshots_user_team_token_provider_uniq").on(t.userId, t.teamId, t.tokenId, t.provider),
    teamIdx: index("user_snapshots_team_idx").on(t.teamId),
    providerIdx: index("user_snapshots_provider_idx").on(t.provider),
  })
);

export const periodSnapshots = pgTable(
  "period_snapshots",
  {
    id: serial("id").primaryKey(),
    // Phase 4.2: 팀별 분리. M6a backfill 시 모든 기존 row → iskra.world.
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    // M6f (2026-05-25): device-scope snapshot. user_snapshots 와 동일 의도.
    tokenId: integer("token_id").references(() => apiTokens.id),
    // Multi-provider (2026-05-29 M): user_snapshots 와 동일 정책. 기존 row
    // default 'claude' 마킹. 마이그 0016.
    provider: text("provider").notNull().default("claude"),
    periodType: text("period_type").notNull(),
    periodStart: date("period_start").notNull(),
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
    rawJson: jsonb("raw_json").notNull(),
  },
  (t) => ({
    // 실제 DB index = (user_id, team_id, period_type, period_start, token_id, provider) NULLS NOT DISTINCT.
    uniq: uniqueIndex("period_snapshots_uniq").on(t.userId, t.teamId, t.periodType, t.periodStart, t.tokenId, t.provider),
    teamIdx: index("period_snapshots_team_idx").on(t.teamId),
    providerIdx: index("period_snapshots_provider_idx").on(t.provider),
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
    // Phase 4.2: 팀별 분리. M6a backfill 시 모든 기존 row → iskra.world.
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    blockId: text("block_id").notNull(),
    // Multi-provider (2026-05-29 M): ccusage blocks 의 provider 분기 저장.
    // 기존 row default 'claude' 마킹. 마이그 0016.
    provider: text("provider").notNull().default("claude"),
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
    userBlockProviderUniq: uniqueIndex("user_blocks_user_team_block_provider_uniq").on(t.userId, t.teamId, t.blockId, t.provider),
    userStartedIdx: index("user_blocks_user_started_idx").on(t.userId, t.startedAt),
    teamIdx: index("user_blocks_team_idx").on(t.teamId),
    providerIdx: index("user_blocks_provider_idx").on(t.provider),
  })
);

// 사용자 제안 (Feedback / Feature Request).
// /suggest 페이지에서 작성 → API 가 DB 에 저장 + Resend 로 info@z21labs.xyz 발송.
// 메일 발송 실패해도 DB 에는 남김 (재발송 가능). emailedAt=null 이면 미발송.
// userId nullable 아님 — 로그인 사용자만 작성 가능.
export const suggestions = pgTable(
  "suggestions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    teamId: integer("team_id").references(() => teams.id),
    // 카테고리: 'feature' | 'ui' | 'bug' | 'other'
    category: text("category").notNull(),
    // 어느 화면에 대한 제안인지 (선택). 'dashboard' | 'team' | 'settings' | 'cli' | 'changelog' | 'other' | null
    contextScreen: text("context_screen"),
    // changelog entry 클릭으로 들어온 경우 entry slug (YYYY-MM-DD)
    contextEntry: text("context_entry"),
    body: text("body").notNull(),
    emailedAt: timestamp("emailed_at"),
    emailError: text("email_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("suggestions_user_idx").on(t.userId),
    createdAtIdx: index("suggestions_created_at_idx").on(t.createdAt),
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
    // Phase 4.2: 팀별 분리. M6a backfill 시 모든 기존 row → iskra.world.
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    date: date("date").notNull(),
    count: integer("count").notNull().default(0),
    totalDwellSeconds: integer("total_dwell_seconds").notNull().default(0),
  },
  (t) => ({
    userDateUniq: uniqueIndex("daily_visits_user_team_date_uniq").on(t.userId, t.teamId, t.date),
    teamIdx: index("daily_visits_team_idx").on(t.teamId),
  })
);
