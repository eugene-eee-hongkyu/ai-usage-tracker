// 대시보드 카드 공유 포맷 헬퍼 (순수 함수). dashboard-view / team-view 내부에 흩어져
// 있던 것과 동일 구현 — 추출한 카드 컴포넌트(src/components/cards/*)가 재사용.
// 통합(unified) 뷰와 기존 뷰가 같은 카드를 쓰므로 포맷도 단일 출처로 둔다.

export function fmt$(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function fmtTokensShort(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function fmtTokens(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function tmpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
