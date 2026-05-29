// ccusage 19.x breaking change: daily row 의 날짜 키가 'date' → 'period' 로 변경.
// DB 안에 두 형식이 섞여 있어 (옛 collector 로 ingest 된 row + 새 collector row) caller 가
// `.date` 한 가지로 일관되게 쓸 수 있도록 normalize 한다.
//
// 손볼 곳 단일화 — 라우트마다 같은 패턴 흩어져서 한 곳 (industryComparison · teamScore)
// 만 빠뜨려도 NEXA 처럼 평균이 1명/1일 데이터로 왜곡됨. lib 1개로 강제 정합.

export interface CcusageDailyRow {
  date?: string;
  period?: string;
  totalCost?: number;
  // Multi-provider (2026-05-30 M): Codex ccusage daily 의 schema 가 Claude 와 다르다.
  //   Claude: totalCost / cacheReadTokens / modelsUsed[]
  //   Codex:  costUSD / cachedInputTokens / models{} (key=model 명)
  // normalize 가 양쪽 동의어를 통일된 키 (totalCost / cacheReadTokens / modelsUsed) 로 변환.
  costUSD?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
  reasoningOutputTokens?: number;
  modelsUsed?: string[];
  models?: Record<string, unknown>;
}

export function normalizeCcusageRow(row: CcusageDailyRow): CcusageDailyRow {
  return {
    ...row,
    date: row.date ?? row.period,
    totalCost: row.totalCost ?? row.costUSD,
    cacheReadTokens: row.cacheReadTokens ?? row.cachedInputTokens,
    modelsUsed: row.modelsUsed ?? (row.models ? Object.keys(row.models) : undefined),
  };
}

export function getCcusageDaily(raw: unknown): CcusageDailyRow[] {
  if (typeof raw !== "object" || raw === null) return [];
  const r = raw as Record<string, unknown>;
  const cu = r.ccusageDaily as { daily?: CcusageDailyRow[] } | undefined;
  return (cu?.daily ?? []).map(normalizeCcusageRow);
}
