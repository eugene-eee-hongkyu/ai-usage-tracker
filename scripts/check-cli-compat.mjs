#!/usr/bin/env node
/**
 * check-cli-compat.mjs — 외부 CLI (codeburn, ccusage) 버전 호환성 자동 검증
 *
 * 목적: 새 버전이 올라왔을 때 우리 ingest 가 의존하는 surface 에 영향 있는지
 *       사람이 30초 안에 핀 업할지 말지 판단할 수 있는 markdown 리포트를 생성.
 *
 * 사용:
 *   node scripts/check-cli-compat.mjs                          # 양쪽 패키지 latest vs 현 핀 모두 검사
 *   node scripts/check-cli-compat.mjs codeburn                 # codeburn 만
 *   node scripts/check-cli-compat.mjs codeburn 0.9.7 0.9.11    # 명시 비교
 *   node scripts/check-cli-compat.mjs ccusage 19.0.2 19.5.0    # ccusage 명시
 *
 * 출력: stdout 에 markdown 리포트 — 4블록 (판정 / 변경 항목 / 우리 영향 / 권장 조치).
 *       CI 가 stdout 을 GitHub issue body 또는 PR comment 로 활용.
 *
 * 종료 코드:
 *   0 — ✓ 안전 (의존 surface 영향 없음)
 *   1 — ⚠️ 주의 (의존 surface 키워드 매칭 있음)
 *   2 — ❌ 위험 (BREAKING / removed 키워드 또는 fetch 실패)
 *
 * 격리 invariant:
 *   - npm install 절대 안 함. 사용자 PC 의 글로벌 codeburn / ccusage 핀은 변경 0.
 *   - 외부 호출은 fetch (npm registry + GitHub API) 만.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dir, "..");

// ────────────────────────────────────────────────────────────────────────
// 패키지 메타. 새 외부 CLI 추가 시 여기만 늘림.
// ────────────────────────────────────────────────────────────────────────
const PACKAGES = {
  codeburn: {
    npm: "codeburn",
    githubRepo: "getagentseal/codeburn",
    pinKey: "CODEBURN",
  },
  ccusage: {
    npm: "ccusage",
    githubRepo: "ryoppippi/ccusage",
    pinKey: "CCUSAGE",
  },
};

// 우리 ingest 가 의존하는 surface 키워드.
// CHANGELOG 본문에 이 키워드가 등장하면 "우리 영향 가능성" 으로 분류.
// 매트릭스 docs/external-cli-compat.md §1 과 동기화 유지.
const SURFACE_KEYWORDS = {
  codeburn: {
    // 명령·옵션 (인자 변경 = 호출 실패)
    cli: ["--provider", "--period", "--from", "--to", "--format", "report"],
    // 응답 필드 (스키마 변경 = 파싱 실패)
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

// 위험 키워드 — BREAKING / removed / rename 시 ❌ 위험 판정.
const RISK_KEYWORDS = ["BREAKING", "removed", "rename", "deprecated", "drop support", "remove support"];

// ────────────────────────────────────────────────────────────────────────
// 현 핀 추출
// ────────────────────────────────────────────────────────────────────────
function readPinnedVersion(pinKey) {
  const path = join(REPO_ROOT, "web/src/lib/pinned-versions.ts");
  const content = readFileSync(path, "utf8");
  const m = content.match(new RegExp(`${pinKey}:\\s*"([^"]+)"`));
  if (!m) throw new Error(`핀 추출 실패: ${pinKey} not found in pinned-versions.ts`);
  return m[1];
}

// ────────────────────────────────────────────────────────────────────────
// npm registry 에서 latest version 가져옴 (글로벌 install X)
// ────────────────────────────────────────────────────────────────────────
async function fetchLatest(npmName) {
  const url = `https://registry.npmjs.org/${npmName}/latest`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`npm registry fetch 실패 (${npmName}): ${res.status}`);
  const json = await res.json();
  return json.version;
}

// ────────────────────────────────────────────────────────────────────────
// GitHub releases 에서 from 다음 ~ to 이하의 모든 release notes 모음
// ────────────────────────────────────────────────────────────────────────
async function fetchReleaseNotesBetween(githubRepo, from, to) {
  const url = `https://api.github.com/repos/${githubRepo}/releases?per_page=100`;
  const headers = { "User-Agent": "ai-usage-tracker-compat-check" };
  if (process.env.GITHUB_TOKEN) headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub releases fetch 실패 (${githubRepo}): ${res.status}`);
  const releases = await res.json();

  // 태그명에서 버전 추출 (mac-v0.9.11, v19.5.0 등 prefix 정규화).
  const normalize = (tag) => tag.replace(/^[a-z-]*v?/i, "");
  const fromCmp = compareVersions.bind(null, from);
  const toCmp = compareVersions.bind(null, to);

  const matched = releases
    .map((r) => ({ ...r, _version: normalize(r.tag_name) }))
    .filter((r) => fromCmp(r._version) < 0 && toCmp(r._version) >= 0)
    .sort((a, b) => compareVersions(a._version, b._version));

  return matched;
}

// semver-ish 비교. major.minor.patch 만 — pre-release 무시.
function compareVersions(a, b) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ────────────────────────────────────────────────────────────────────────
// 의존 surface 키워드 매칭
// ────────────────────────────────────────────────────────────────────────
function detectImpacts(text, keywords) {
  const hits = [];
  for (const kw of keywords) {
    const re = new RegExp(`\\b${kw.replace(/\./g, "\\.").replace(/-/g, "\\-")}\\b`, "i");
    if (re.test(text)) hits.push(kw);
  }
  return hits;
}

function detectRisks(text) {
  const hits = [];
  for (const kw of RISK_KEYWORDS) {
    if (text.toLowerCase().includes(kw.toLowerCase())) hits.push(kw);
  }
  return hits;
}

// ────────────────────────────────────────────────────────────────────────
// 리포트 빌드 — 4블록 markdown
// ────────────────────────────────────────────────────────────────────────
function buildReport({ pkg, from, to, releases, impactCli, impactSchema, risks }) {
  const verdict = risks.length > 0
    ? "❌ 위험 (자동 핀 업 비추천)"
    : (impactCli.length + impactSchema.length) > 0
      ? "⚠️ 주의 (수동 검증 후 핀 업)"
      : "✓ 안전 (핀 업 가능)";

  const lines = [];
  lines.push(`# ${pkg} ${from} → ${to} 호환성 리포트`);
  lines.push("");
  lines.push(`**판정**: ${verdict}`);
  lines.push("");

  // 블록 1 — 변경 항목
  lines.push("## 변경 항목 (release notes 발췌)");
  lines.push("");
  if (releases.length === 0) {
    lines.push("_(release notes 없음 — `${from}` 다음 ~ `${to}` 사이 GitHub release 0개)_");
  } else {
    for (const r of releases) {
      lines.push(`### ${r._version} (${r.published_at?.slice(0, 10) ?? "?"})`);
      lines.push("");
      const body = (r.body ?? "").trim();
      lines.push(body ? body.slice(0, 800) + (body.length > 800 ? "\n…(truncated)" : "") : "_(release notes 비어있음)_");
      lines.push("");
    }
  }

  // 블록 2 — 우리 코드 영향
  lines.push("## 우리 코드 영향 (의존 surface 키워드 매칭)");
  lines.push("");
  if (impactCli.length === 0 && impactSchema.length === 0) {
    lines.push("- 매트릭스 §1 의존 surface 키워드 매칭 0건. ingest 영향 없음 추정.");
  } else {
    if (impactCli.length > 0) {
      lines.push(`- **CLI 인자 영향 가능성**: ${impactCli.map((k) => "`" + k + "`").join(", ")} — [매트릭스 §1-1, §1-2](../docs/external-cli-compat.md#1-우리-의존-surface) 호출 패턴 확인 필요.`);
    }
    if (impactSchema.length > 0) {
      lines.push(`- **응답 schema 영향 가능성**: ${impactSchema.map((k) => "`" + k + "`").join(", ")} — [매트릭스 §1-3, §1-4](../docs/external-cli-compat.md#1-3-codeburn-응답-필드-우리가-읽는-것) 필드 매핑 확인 필요.`);
    }
  }
  if (risks.length > 0) {
    lines.push("");
    lines.push(`- ⚠️ **위험 키워드 감지**: ${risks.map((k) => "`" + k + "`").join(", ")} — release notes 상세 검토 필수.`);
  }
  lines.push("");

  // 블록 3 — fixture 결과 (현재는 placeholder, 단계 4b binary 실행 모드에서 채움)
  lines.push("## fixture 결과");
  lines.push("");
  lines.push("- _(CHANGELOG diff 모드 — fixture 직접 실행 안 함. 핀 업 직전 수동 검증: `tests/fixtures/ingest-body.json` 으로 `runIngest` 호출 → 결과 비교.)_");
  lines.push("");

  // 블록 4 — 권장 조치
  lines.push("## 권장 조치");
  lines.push("");
  if (verdict.startsWith("✓")) {
    lines.push(`1. [pinned-versions.ts:5](../web/src/lib/pinned-versions.ts#L5) 의 \`${PACKAGES[pkg].pinKey}\` 를 "${to}" 로 변경.`);
    lines.push(`2. [cli/src/init.ts](../cli/src/init.ts) 의 \`npm install -g ${pkg}@${from}\` → \`@${to}\` 로 변경 (line 747 또는 767).`);
    lines.push(`3. PR 만들기 + 다음 ingest 1회 후 dashboard 정상 확인.`);
  } else if (verdict.startsWith("⚠️")) {
    lines.push(`1. 위 "우리 코드 영향" 키워드를 [매트릭스 §1](../docs/external-cli-compat.md) 의 필드/명령 표와 1:1 매핑.`);
    lines.push(`2. 영향 받는 line 에 수정 (예: 필드명 변경 → run-ingest.ts 파싱 수정).`);
    lines.push(`3. \`tests/fixtures/ingest-body.json\` 갱신 후 단위 테스트 (manual).`);
    lines.push(`4. 위 모두 끝나면 핀 업 (✓ 안전 절차).`);
  } else {
    lines.push(`1. release notes 의 BREAKING / removed 항목 정확히 식별.`);
    lines.push(`2. backlog 등록 — 다른 작업 우선. 핀 동결 유지.`);
    lines.push(`3. 외부 회사 사용자 영향 큰 변경이면 upstream issue/PR 검토.`);
  }
  lines.push("");

  // 메타 푸터
  lines.push("---");
  lines.push("");
  lines.push(`<sub>자동 생성: scripts/check-cli-compat.mjs · 매트릭스: [docs/external-cli-compat.md](../docs/external-cli-compat.md)</sub>`);

  return lines.join("\n");
}

// ────────────────────────────────────────────────────────────────────────
// 단일 패키지 검사
// ────────────────────────────────────────────────────────────────────────
async function checkOne(pkg, from, to) {
  const meta = PACKAGES[pkg];
  if (!meta) throw new Error(`알 수 없는 패키지: ${pkg}`);

  // from 생략 시 현 핀, to 생략 시 npm latest.
  const fromVer = from ?? readPinnedVersion(meta.pinKey);
  const toVer = to ?? await fetchLatest(meta.npm);

  if (compareVersions(fromVer, toVer) >= 0) {
    return {
      verdict: "✓ 안전",
      exitCode: 0,
      report: `# ${pkg}: 핀 (\`${fromVer}\`) 이 latest (\`${toVer}\`) 와 같거나 더 신선. 검사 skip.`,
    };
  }

  const releases = await fetchReleaseNotesBetween(meta.githubRepo, fromVer, toVer);
  const concatBody = releases.map((r) => r.body ?? "").join("\n\n");

  const surface = SURFACE_KEYWORDS[pkg];
  const impactCli = detectImpacts(concatBody, surface.cli);
  const impactSchema = detectImpacts(concatBody, surface.schema);
  const risks = detectRisks(concatBody);

  const report = buildReport({
    pkg, from: fromVer, to: toVer, releases, impactCli, impactSchema, risks,
  });

  const exitCode = risks.length > 0 ? 2 : (impactCli.length + impactSchema.length) > 0 ? 1 : 0;

  return { exitCode, report };
}

// ────────────────────────────────────────────────────────────────────────
// CLI 진입
// ────────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const targets = args.length === 0
    ? ["codeburn", "ccusage"]
    : [args[0]];
  const explicitFrom = args[1];
  const explicitTo = args[2];

  let worstExit = 0;
  const reports = [];

  for (const pkg of targets) {
    try {
      const { exitCode, report } = await checkOne(pkg, explicitFrom, explicitTo);
      reports.push(report);
      if (exitCode > worstExit) worstExit = exitCode;
    } catch (e) {
      reports.push(`# ${pkg}: 검사 실패\n\n\`\`\`\n${e.message}\n\`\`\``);
      worstExit = Math.max(worstExit, 2);
    }
  }

  process.stdout.write(reports.join("\n\n---\n\n") + "\n");
  process.exit(worstExit);
}

main().catch((e) => {
  process.stderr.write(`치명 오류: ${e.stack ?? e.message}\n`);
  process.exit(2);
});
