// 외부 CLI (codeburn, ccusage) 버전 호환성 검사 — Vercel cron 과 로컬 scripts 양쪽에서 호출.
//
// 격리 invariant: npm install 절대 안 함. fetch (npm registry + GitHub API) 만.
// 사용자 PC / Vercel runner 의 글로벌 codeburn / ccusage 환경 변동 0.
//
// 매트릭스: docs/external-cli-compat.md §1 의 의존 surface 키워드를 release notes 본문과 매칭.
// 자세한 시스템 디자인 / 사람용 핀 업 판단 흐름은 매트릭스 §7 참조.

import { PINNED } from "./pinned-versions";

export type Verdict = "safe" | "caution" | "danger" | "fetch-failed";

export interface CompatResult {
  pkg: PackageKey;
  from: string;
  to: string;
  verdict: Verdict;
  reportMarkdown: string;
  impactCli: string[];
  impactSchema: string[];
  risks: string[];
  releases: ReleaseLite[];
}

interface ReleaseLite {
  version: string;
  publishedAt: string;
  body: string;
}

export type PackageKey = "codeburn" | "ccusage";

const PACKAGES: Record<PackageKey, {
  npm: string;
  githubRepo: string;
  pinKey: keyof typeof PINNED;
}> = {
  codeburn: { npm: "codeburn", githubRepo: "getagentseal/codeburn", pinKey: "CODEBURN" },
  ccusage: { npm: "ccusage", githubRepo: "ryoppippi/ccusage", pinKey: "CCUSAGE" },
};

// 매트릭스 §1 동기화 유지. 새 의존 필드/명령 생기면 여기 추가.
const SURFACE_KEYWORDS: Record<PackageKey, { cli: string[]; schema: string[] }> = {
  codeburn: {
    cli: ["--provider", "--period", "--from", "--to", "--format", "report"],
    schema: [
      "overview", "totalCost", "totalSessions", "callsCount",
      "activities", "oneShotRate", "turns",
      "projects", "topSessions", "daily",
      "tokens.input", "tokens.output", "tokens.cacheRead", "tokens.cacheWrite",
      "today.period", "today.daily",
    ],
  },
  ccusage: {
    cli: ["daily", "blocks", "--json", "--since", "--until"],
    schema: [
      "totalCost", "inputTokens", "outputTokens",
      "cacheReadTokens", "cacheCreationTokens", "totalTokens", "modelsUsed",
      "period", "date",
      "startTime", "endTime", "actualEndTime", "isGap", "isActive",
      "entries", "costUSD", "models",
    ],
  },
};

const RISK_KEYWORDS = ["BREAKING", "removed", "rename", "deprecated", "drop support", "remove support"];

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function fetchLatest(npmName: string): Promise<string> {
  const res = await fetch(`https://registry.npmjs.org/${npmName}/latest`);
  if (!res.ok) throw new Error(`npm registry fetch 실패 (${npmName}): ${res.status}`);
  const json = (await res.json()) as { version: string };
  return json.version;
}

async function fetchReleasesBetween(repo: string, from: string, to: string): Promise<ReleaseLite[]> {
  const headers: Record<string, string> = { "User-Agent": "ai-usage-tracker-compat-check" };
  if (process.env.GITHUB_TOKEN) headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, { headers });
  if (!res.ok) throw new Error(`GitHub releases fetch 실패 (${repo}): ${res.status}`);
  const releases = (await res.json()) as Array<{ tag_name: string; body?: string; published_at?: string }>;

  // 태그 prefix 정규화 (mac-v0.9.11 / v19.5.0 등). 같은 버전 중복 dedup.
  const seen = new Set<string>();
  const out: ReleaseLite[] = [];
  for (const r of releases) {
    const v = r.tag_name.replace(/^[a-z-]*v?/i, "");
    if (seen.has(v)) continue;
    if (compareVersions(v, from) <= 0 || compareVersions(v, to) > 0) continue;
    seen.add(v);
    out.push({ version: v, publishedAt: (r.published_at ?? "").slice(0, 10), body: (r.body ?? "").trim() });
  }
  out.sort((a, b) => compareVersions(a.version, b.version));
  return out;
}

function detectImpacts(text: string, keywords: string[]): string[] {
  const hits: string[] = [];
  for (const kw of keywords) {
    const escaped = kw.replace(/\./g, "\\.").replace(/-/g, "\\-");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) hits.push(kw);
  }
  return hits;
}

function detectRisks(text: string): string[] {
  const lower = text.toLowerCase();
  return RISK_KEYWORDS.filter((k) => lower.includes(k.toLowerCase()));
}

function buildReport(args: {
  pkg: PackageKey;
  from: string;
  to: string;
  releases: ReleaseLite[];
  impactCli: string[];
  impactSchema: string[];
  risks: string[];
}): { verdict: Verdict; markdown: string } {
  const { pkg, from, to, releases, impactCli, impactSchema, risks } = args;
  const verdict: Verdict =
    risks.length > 0 ? "danger" : (impactCli.length + impactSchema.length) > 0 ? "caution" : "safe";
  const verdictLabel = {
    safe: "✓ 안전 (핀 업 가능)",
    caution: "⚠️ 주의 (수동 검증 후 핀 업)",
    danger: "❌ 위험 (자동 핀 업 비추천)",
    "fetch-failed": "fetch 실패",
  }[verdict];

  const lines: string[] = [];
  lines.push(`# ${pkg} ${from} → ${to} 호환성 리포트`);
  lines.push("");
  lines.push(`**판정**: ${verdictLabel}`);
  lines.push("");
  lines.push("## 변경 항목 (release notes 발췌)");
  lines.push("");
  if (releases.length === 0) {
    lines.push(`_(release notes 없음 — \`${from}\` 다음 ~ \`${to}\` 사이 GitHub release 0개)_`);
  } else {
    for (const r of releases) {
      lines.push(`### ${r.version} (${r.publishedAt || "?"})`);
      lines.push("");
      lines.push(r.body ? r.body.slice(0, 800) + (r.body.length > 800 ? "\n…(truncated)" : "") : "_(release notes 비어있음)_");
      lines.push("");
    }
  }
  lines.push("## 우리 코드 영향 (의존 surface 키워드 매칭)");
  lines.push("");
  if (impactCli.length === 0 && impactSchema.length === 0) {
    lines.push("- 매트릭스 §1 의존 surface 키워드 매칭 0건. ingest 영향 없음 추정.");
  } else {
    if (impactCli.length > 0) {
      lines.push(`- **CLI 인자 영향 가능성**: ${impactCli.map((k) => "`" + k + "`").join(", ")} — 매트릭스 §1-1, §1-2 호출 패턴 확인 필요.`);
    }
    if (impactSchema.length > 0) {
      lines.push(`- **응답 schema 영향 가능성**: ${impactSchema.map((k) => "`" + k + "`").join(", ")} — 매트릭스 §1-3, §1-4 필드 매핑 확인 필요.`);
    }
  }
  if (risks.length > 0) {
    lines.push("");
    lines.push(`- ⚠️ **위험 키워드 감지**: ${risks.map((k) => "`" + k + "`").join(", ")} — release notes 상세 검토 필수.`);
  }
  lines.push("");
  lines.push("## fixture 결과");
  lines.push("");
  lines.push("- _(CHANGELOG diff 모드 — binary 실행 X. 핀 업 직전 수동 검증: `tests/fixtures/ingest-body.json` 으로 `runIngest` 호출 → 결과 비교.)_");
  lines.push("");
  lines.push("## 권장 조치");
  lines.push("");
  if (verdict === "safe") {
    lines.push(`1. \`pinned-versions.ts:5\` 의 \`${PACKAGES[pkg].pinKey}\` 를 "${to}" 로 변경.`);
    lines.push(`2. \`cli/src/init.ts\` 의 \`npm install -g ${pkg}@${from}\` → \`@${to}\` 로 변경 (line 747 또는 767).`);
    lines.push(`3. PR 만들기 + 다음 ingest 1회 후 dashboard 정상 확인.`);
  } else if (verdict === "caution") {
    lines.push(`1. 위 "우리 코드 영향" 키워드를 매트릭스 §1 의 필드/명령 표와 1:1 매핑.`);
    lines.push(`2. 영향 받는 line 에 수정 (예: 필드명 변경 → run-ingest.ts 파싱 수정).`);
    lines.push(`3. \`tests/fixtures/ingest-body.json\` 갱신 후 단위 테스트 (manual).`);
    lines.push(`4. 위 모두 끝나면 핀 업 (✓ 안전 절차).`);
  } else {
    lines.push(`1. release notes 의 BREAKING / removed 항목 정확히 식별.`);
    lines.push(`2. backlog 등록 — 다른 작업 우선. 핀 동결 유지.`);
    lines.push(`3. 외부 회사 사용자 영향 큰 변경이면 upstream issue/PR 검토.`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`<sub>자동 생성: /api/cron/cli-compat-check · 매트릭스: docs/external-cli-compat.md</sub>`);

  return { verdict, markdown: lines.join("\n") };
}

export async function checkCliCompat(pkg: PackageKey, fromOverride?: string, toOverride?: string): Promise<CompatResult> {
  const meta = PACKAGES[pkg];
  const from = fromOverride ?? PINNED[meta.pinKey];
  const to = toOverride ?? await fetchLatest(meta.npm);

  if (compareVersions(from, to) >= 0) {
    return {
      pkg, from, to,
      verdict: "safe",
      reportMarkdown: `# ${pkg}: 핀 (\`${from}\`) 이 latest (\`${to}\`) 와 같거나 더 신선. 검사 skip.`,
      impactCli: [], impactSchema: [], risks: [], releases: [],
    };
  }

  const releases = await fetchReleasesBetween(meta.githubRepo, from, to);
  const concatBody = releases.map((r) => r.body).join("\n\n");
  const surface = SURFACE_KEYWORDS[pkg];
  const impactCli = detectImpacts(concatBody, surface.cli);
  const impactSchema = detectImpacts(concatBody, surface.schema);
  const risks = detectRisks(concatBody);

  const { verdict, markdown } = buildReport({ pkg, from, to, releases, impactCli, impactSchema, risks });

  return { pkg, from, to, verdict, reportMarkdown: markdown, impactCli, impactSchema, risks, releases };
}
