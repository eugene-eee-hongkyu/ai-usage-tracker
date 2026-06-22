// from → to 사이 GitHub 릴리즈 노트를 모아, 각 변경 줄을 버킷으로 분류한다.
//
// 구조 변경 여부의 "확정 판정"은 verify.mjs(실측)가 한다. 여기서는 구조가 안전하더라도
// "저장되는 값이 달라질 수 있는" 변경(가격/세션 포함범위/캐시/timezone 등)을 사람에게
// 알려주는 "값 변동 힌트"를 뽑는다.
//
//   value(🟡)      — 같은 키인데 숫자가 달라질 수 있는 변경
//   structural(🔴) — 필드/명령 구조를 건드릴 수 있는 위험 키워드(verify 가 최종 확정)
//   neutral(⚪)    — 성능/CI/빌드/문서 등 우리와 무관

const STRUCTURAL = [
  "breaking", "rename", "renamed", "remove", "removed", "deprecat", "drop support",
  "remove support", "schema", "json output", "output format",
];
const VALUE = [
  "pricing", "price", "cost", "cache", "dedup", "duplicate", "archived", "include",
  "session", "filter", "timezone", "tz ", "token count", "counting", "models.dev",
  "offline pricing", "model alias", "fallback",
];
const NEUTRAL = [
  "nix", " ci", "ci:", "build", "treefmt", "crane", "workflow", "runner", "binary",
  "pre-commit", "docs", "doc:", "readme", "test", "lint", "format", "release", "bump",
  "dependency", "deps", "chore", "refactor", "perf", "performance", "parallelize",
  "prefilter", "homebrew", "install",
];

function classifyLine(line) {
  const l = line.toLowerCase();
  if (STRUCTURAL.some((k) => l.includes(k))) return "structural";
  if (VALUE.some((k) => l.includes(k))) return "value";
  if (NEUTRAL.some((k) => l.includes(k))) return "neutral";
  return "other";
}

// 릴리즈 노트 본문에서 의미 있는 bullet 줄만 추출 (마크다운 장식·링크 제거).
function extractBullets(body) {
  const out = [];
  for (let raw of body.split("\n")) {
    let s = raw.replace(/&nbsp;/g, " ").trim();
    if (!s.startsWith("-") && !s.startsWith("*")) continue;
    s = s.replace(/^[-*]\s*/, "");
    // "by @user in https://..." 꼬리·<samp>해시</samp>·마크다운 링크 정리
    s = s.replace(/\s*&nbsp;-&nbsp;.*$/i, "");
    s = s.replace(/\s*-\s*by\s+@[\w-]+.*$/i, "");
    s = s.replace(/\s+in\s+https?:\/\/\S+/gi, "");
    s = s.replace(/<samp>.*?<\/samp>/gi, "");
    s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    s = s.replace(/`/g, "").replace(/\*\*/g, "").trim();
    if (s.length > 2) out.push(s);
  }
  return out;
}

async function fetchReleases(repo, from, to, cmpVer) {
  const headers = { "User-Agent": "ai-usage-tracker-compat-check" };
  if (process.env.GITHUB_TOKEN) headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, { headers });
  if (!res.ok) throw new Error(`GitHub releases fetch 실패 (${repo}): ${res.status}`);
  const releases = await res.json();
  const seen = new Set();
  const out = [];
  for (const r of releases) {
    const v = (r.tag_name || "").replace(/^[a-z-]*v?/i, "");
    if (!v || seen.has(v)) continue;
    if (cmpVer(v, from) <= 0 || cmpVer(v, to) > 0) continue;
    seen.add(v);
    out.push({ version: v, date: (r.published_at || "").slice(0, 10), bullets: extractBullets(r.body || "") });
  }
  out.sort((a, b) => cmpVer(a.version, b.version));
  return out;
}

// 반환: { value:[{version,text}], structural:[...], neutral:[...], releaseCount }
export async function collectReleaseNotes(repo, from, to, cmpVer) {
  const releases = await fetchReleases(repo, from, to, cmpVer);
  const buckets = { value: [], structural: [], neutral: [] };
  for (const r of releases) {
    for (const b of r.bullets) {
      const cls = classifyLine(b);
      if (cls === "value") buckets.value.push({ version: r.version, text: b });
      else if (cls === "structural") buckets.structural.push({ version: r.version, text: b });
      else if (cls === "neutral") buckets.neutral.push({ version: r.version, text: b });
      // "other" 는 버림 (노이즈)
    }
  }
  return { ...buckets, releaseCount: releases.length };
}
