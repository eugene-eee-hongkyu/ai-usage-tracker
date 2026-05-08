import type { Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_ROOT = resolve(__dirname, "../../../db/seed");

export type PersonaId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "team-mixed";

const EMAIL_BY_PERSONA: Record<PersonaId, string | null> = {
  P1: null,
  P2: "alice@iskra.world",
  P3: "eugene.eee@iskra.world",
  P4: "bob@iskra.world",
  P5: "carol@iskra.world",
  P6: "dave@iskra.world",
  P7: "bob@iskra.world",
  P8: "eugene.eee@iskra.world", // admin 본인
  "team-mixed": "eugene.eee@iskra.world", // P3 admin 으로 진입
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
