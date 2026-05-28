// 보안 감사 (2026-05-28): 옛 default 인 본인 이메일 하드코딩 제거.
// 미설정이면 Platform Admin 0명 — 공개 fork 또는 env 누락 배포에서 임의 사용자가
// 자동 Platform Admin 되는 결함 차단. 본 운영 배포는 Vercel env 에 ADMIN_EMAIL
// 반드시 세팅 (없으면 콘솔 경고 + 모든 isAdmin() false).
const raw = process.env.ADMIN_EMAIL ?? "";
const ADMIN_EMAILS = new Set(raw.split(",").map((e) => e.trim()).filter(Boolean));

if (ADMIN_EMAILS.size === 0 && process.env.NODE_ENV === "production") {
  console.warn(
    "[admin] ADMIN_EMAIL not set — Platform Admin features (view-as, all-teams, all-personal, ranking admin) disabled.",
  );
}

export function isAdmin(email: string) {
  return ADMIN_EMAILS.has(email);
}
