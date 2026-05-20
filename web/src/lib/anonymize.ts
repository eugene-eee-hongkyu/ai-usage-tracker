// 다른 팀 비교용 이름 익명화.
//
// 규칙 (사용자 결정, 2026-05-20):
//   - 첫 1자 + 가운데 길이만큼 '*' + 끝 1자
//   - 1자 → "*" 한 개
//   - 2자 → 첫 1자 + "*" (끝 1자 안 보임. 너무 짧으면 보호 우선)
//   - >=3자 → first + ('*' × (len-2)) + last
//
// 한글·영문·공백·특수문자 무관 — 길이 기준만 봄.
// 예: "이경준" → "이*준", "Youngjin Kim" → "Y**********m", "X" → "*".
//
// server-side 에서 응답 페이로드에 적용 — 다른 팀 실명이 wire 에도 안 실리게.

export function anonymizeName(name: string | null | undefined): string {
  if (!name) return "***";
  const trimmed = name.trim();
  if (trimmed.length === 0) return "***";
  if (trimmed.length === 1) return "*";
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  const middle = "*".repeat(trimmed.length - 2);
  return `${first}${middle}${last}`;
}
