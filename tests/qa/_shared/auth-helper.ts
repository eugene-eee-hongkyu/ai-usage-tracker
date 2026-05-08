import type { Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_ROOT = resolve(__dirname, "../../../db/seed");

export type PersonaId = "P1" | "P2" | "P3";

const EMAIL_BY_PERSONA: Record<PersonaId, string | null> = {
  P1: null,
  P2: "alice@iskra.world",
  P3: "eugene.eee@iskra.world",
};

export function seed(persona: PersonaId): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정 — web/.env.local 또는 셸 export 필요");
  execSync(`psql "${url}" -f "${SEED_ROOT}/${persona}.sql"`, { stdio: "pipe" });
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
