// 공용 이메일 도메인 블랙리스트.
// 이 도메인은 owner 의 OAuth email 이라도 auto_join_domains 에 자동 등록 안 함.
// 사고 방지: 한 회사가 'gmail.com' 자동 가입 도메인 가지면 전 세계 자동 가입.
//
// 추가가 필요하면 여기 추가. 사용자 가이드 — gmail 등으로 owner 등록은 의도된 케이스
// (예: 시범 팀, 개인) — 그 경우 auto-join 자체가 의미 없으니 빈 도메인 + toggle 끔.

const PUBLIC_DOMAINS = new Set<string>([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.kr",
  "yahoo.co.jp",
  "naver.com",
  "daum.net",
  "kakao.com",
  "hanmail.net",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "duck.com",
  "fastmail.com",
  "qq.com",
  "163.com",
  "126.com",
]);

export function isPublicEmailDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return PUBLIC_DOMAINS.has(domain.toLowerCase().trim());
}
