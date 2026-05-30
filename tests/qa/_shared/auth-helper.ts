import type { Page, Route } from "@playwright/test";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_ROOT = resolve(__dirname, "../../../db/seed");

export type PersonaId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "P9" | "team-mixed" | "team-codex" | "team-codex-oreo" | "team-codex-bob";

const EMAIL_BY_PERSONA: Record<PersonaId, string | null> = {
  P1: null,
  P2: "alice@iskra.world",
  P3: "eugene.eee@iskra.world",
  P4: "bob@iskra.world",
  P5: "carol@iskra.world",
  P6: "dave@iskra.world",
  P7: "bob@iskra.world",
  P8: "eugene.eee@iskra.world", // admin 본인
  P9: "p9@iskra.world",          // Codex 사용 personal user (codex_plan_tier=NULL 시작)
  "team-mixed": "eugene.eee@iskra.world", // P3 admin 으로 진입
  // team-codex fixture 의 세 멤버 시점별 로그인
  "team-codex":      "eugene.eee@iskra.world", // admin / platform admin
  "team-codex-oreo": "oreo@iskra.world",       // Codex 사용 멤버
  "team-codex-bob":  "bob@iskra.world",        // Claude only 멤버
};

export function seed(persona: PersonaId): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정 — web/.env.local 또는 셸 export 필요");
  execSync(`psql "${url}" -f "${SEED_ROOT}/${persona}.sql"`, { stdio: "pipe" });
}

/** P{n} 시드 후 user.last_synced_at 을 N 시간 전으로 변형 (stale boundary 검증용). */
export function patchSync(userId: number, hoursAgo: number): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정");
  execSync(
    `psql "${url}" -c "UPDATE users SET last_synced_at = NOW() - INTERVAL '${hoursAgo} hours' WHERE id = ${userId}"`,
    { stdio: "pipe" },
  );
}

/** raw_json.all.daily 의 특정 date 의 cost 를 변형 (heatmap boundary 검증용). */
export function patchDailyCost(userId: number, date: string, cost: number): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정");
  execSync(
    `psql "${url}" -c "UPDATE user_snapshots SET raw_json = jsonb_set(raw_json, '{all,daily}', (SELECT jsonb_agg(CASE WHEN d->>'date' = '${date}' THEN jsonb_set(d, '{cost}', '${cost}'::jsonb) ELSE d END) FROM jsonb_array_elements(raw_json->'all'->'daily') d)) WHERE user_id = ${userId}"`,
    { stdio: "pipe" },
  );
}

/** raw_json.ccusageDaily.daily 의 특정 date 의 totalCost 를 변형 (heatmap activity 검증용 — ccusage 우선). */
export function patchCcusageDaily(userId: number, date: string, totalCost: number): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정");
  execSync(
    `psql "${url}" -c "UPDATE user_snapshots SET raw_json = jsonb_set(raw_json, '{ccusageDaily,daily}', (SELECT jsonb_agg(CASE WHEN d->>'date' = '${date}' THEN jsonb_set(d, '{totalCost}', '${totalCost}'::jsonb) ELSE d END) FROM jsonb_array_elements(raw_json->'ccusageDaily'->'daily') d)) WHERE user_id = ${userId}"`,
    { stdio: "pipe" },
  );
}

/** daily_visits 의 특정 date 의 dwell 을 변형 (dwell heatmap boundary 검증용).
 * team_id 는 user 의 첫 active team_members 행에서 가져옴 — Phase 4.2 (M6a)
 * 부터 daily_visits 가 team-scoped (NOT NULL + uniq (user_id, team_id, date)).
 * 옛 helper 는 team_id 없이 INSERT 하다 NOT NULL 위반으로 silent throw. */
export function patchDailyVisit(userId: number, date: string, count: number, dwellSec: number): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정");
  execSync(
    `psql "${url}" -c "INSERT INTO daily_visits (user_id, team_id, date, count, total_dwell_seconds) SELECT ${userId}, (SELECT team_id FROM team_members WHERE user_id = ${userId} AND deleted_at IS NULL ORDER BY joined_at LIMIT 1), '${date}', ${count}, ${dwellSec} ON CONFLICT (user_id, team_id, date) DO UPDATE SET count = ${count}, total_dwell_seconds = ${dwellSec}"`,
    { stdio: "pipe" },
  );
}

/** user_snapshots 컬럼 직접 수정 (efficiency 5단계 검증용). */
export function patchSnapshot(userId: number, fields: Record<string, number>): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정");
  const setClause = Object.entries(fields)
    .map(([k, v]) => `${k} = ${v}`)
    .join(", ");
  execSync(
    `psql "${url}" -c "UPDATE user_snapshots SET ${setClause} WHERE user_id = ${userId}"`,
    { stdio: "pipe" },
  );
}

/** raw_json.all.overview.<field> 변경 — dashboard route 가 raw_json 에서 cacheHitPct/totalCost 등 우선 읽음. */
export function patchOverview(userId: number, field: string, value: number): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정");
  execSync(
    `psql "${url}" -c "UPDATE user_snapshots SET raw_json = jsonb_set(raw_json, '{all,overview,${field}}', '${value}'::jsonb) WHERE user_id = ${userId}"`,
    { stdio: "pipe" },
  );
}

export async function signInAs(page: Page, persona: PersonaId): Promise<void> {
  const email = EMAIL_BY_PERSONA[persona];
  if (!email) throw new Error(`persona ${persona} 는 비로그인 — signInAs 사용 부적합`);

  const csrfRes = await page.request.get("/api/auth/csrf");
  if (!csrfRes.ok()) throw new Error(`/api/auth/csrf 실패: ${csrfRes.status()}`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const cbRes = await page.request.post("/api/auth/callback/credentials", {
    form: { email, csrfToken, callbackUrl: "/dashboard", json: "true" },
  });
  if (!cbRes.ok()) {
    throw new Error(`Credentials sign-in 실패: ${cbRes.status()} ${await cbRes.text()}`);
  }
}

export async function clearSession(page: Page): Promise<void> {
  await page.context().clearCookies();
}

/** psql 로 임의 SELECT 1행 1컬럼 값 반환 (codex spec 의 plan tier 저장 검증용). */
export function queryScalar(sql: string): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정");
  const out = execSync(
    `psql "${url}" -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { stdio: ["pipe", "pipe", "pipe"] },
  ).toString().trim();
  return out;
}

/** page.route stub — /api/dashboard 응답 overview 필드 변형 (efficiency 5단계 검증용). */
export async function stubOverview(page: Page, fields: Record<string, number>): Promise<void> {
  await page.route("**/api/dashboard*", async (r: Route) => {
    const original = await r.fetch();
    const body = await original.json();
    if (body.overview) Object.assign(body.overview, fields);
    await r.fulfill({ response: original, json: body });
  });
}

/** page.route stub — /api/dashboard 응답 임의 변형 (callback). */
export async function stubDashboard(page: Page, mutate: (body: Record<string, unknown>) => void): Promise<void> {
  await page.route("**/api/dashboard*", async (r: Route) => {
    const original = await r.fetch();
    const body = await original.json();
    mutate(body);
    await r.fulfill({ response: original, json: body });
  });
}
