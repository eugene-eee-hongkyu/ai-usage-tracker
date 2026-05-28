// 빌드 전 GitHub REST API 로 main 의 누적 commit count 가져와 .build-version 에 저장.
// next.config.mjs 의 buildVersion 계산이 이 파일을 읽음.
//
// 배경: Vercel 은 shallow clone (depth ~10) 로 빌드 환경 구성 → 로컬의
// `git rev-list --count HEAD` 가 10 까지만 셈. GitHub API 의 Link 헤더 우회로
// 정확한 누적 commit count 획득.
//
// public repo 라 unauthenticated 60req/hour 충분 (배포 빈도 << 60/h).
// fetch 실패 시 fallback "0" — 빌드 깨지 않게 처리.

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, "..", ".build-version");

const OWNER = "eugene-eee-hongkyu";
const REPO = "ai-usage-tracker";
const BRANCH = "main";

async function fetchCount() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/commits?sha=${BRANCH}&per_page=1`;
  const r = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error(`GitHub API ${r.status}`);
  const link = r.headers.get("link");
  if (!link) {
    // page 가 1 페이지뿐일 때 (commit 1개) Link 헤더 없음. 1 로 fallback.
    return 1;
  }
  const match = link.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  if (!match) throw new Error("link header parse failed");
  return parseInt(match[1], 10);
}

(async () => {
  let count;
  try {
    count = await fetchCount();
    console.log(`[fetch-build-version] count=${count}`);
  } catch (e) {
    // 기존 .build-version 이 있으면 유지, 없으면 0
    let prev = "0";
    try { prev = readFileSync(outFile, "utf-8").trim(); } catch { /* ignore */ }
    console.warn(`[fetch-build-version] failed (${String(e)}), keeping prev=${prev}`);
    count = parseInt(prev, 10) || 0;
  }
  writeFileSync(outFile, String(count));
})();
