#!/usr/bin/env node
/**
 * Historical backfill — codeburn `--from`/`--to` 로 과거 주/달 raw JSON 추출 후
 * /api/ingest/historical 로 POST. init/repair 시 background spawn 됨.
 *
 * 윈도우:
 *   - last 8 weeks (이번 주 제외, 8주 전까지)
 *   - last 12 months (이번 달 제외, 12개월 전까지)
 *
 * Boundary 는 사용자 로컬 timezone 기준. CODEBURN_TZ env 주입 필수.
 * 서버 측 onConflictDoNothing 으로 idempotent — 매 repair 마다 안전 재실행 가능.
 */

import { spawn } from "child_process";
import { existsSync, readFileSync, statSync, truncateSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const childEnv = { ...process.env, TZ: SYSTEM_TZ, CODEBURN_TZ: SYSTEM_TZ };

// Multi-provider (2026-05-29): Claude + Codex 분리 backfill.
// 각 (period, provider) 가 별도 snapshot row. 빈 데이터는 drop (isEmpty 판정 그대로).
const PROVIDERS = ["claude", "codex"];

// destinations 로더 — sync.mjs / destinations.ts 와 동일 패턴.
// 우선순위:
//   1. ~/.usage-tracker/config.json 의 destinations[] (위저드가 만든 .dmg 환경)
//   2. env (USAGE_TRACKER_URL + apiKey 또는 fallback) — install.sh / 단일 destination
async function loadDestinations() {
  const configPath =
    process.env.USAGE_TRACKER_CONFIG ?? join(homedir(), ".usage-tracker", "config.json");
  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.destinations && Array.isArray(parsed.destinations) && parsed.destinations.length > 0) {
      return parsed.destinations.map((d) => ({
        name: d.name,
        url: String(d.url).replace(/\/$/, ""),
        apiKey: d.apiKey ?? null,
      }));
    }
  } catch {
    // 파일 없음·파싱 실패 → env fallback
  }
  // 단일 destination fallback (install.sh 흐름)
  const url = (process.env.USAGE_TRACKER_URL ?? "https://aiusage.z21labs.world").replace(/\/$/, "");
  const apiKey = await loadApiKey();
  return [{ name: "default", url, apiKey }];
}

// 새 위치 우선, 옛 위치 fallback
const NEW_STABLE_DIR = join(homedir(), ".z21labs", "usage-tracker");
const LEGACY_STABLE_DIR = join(homedir(), ".primus-usage-tracker");
const STABLE_DIR_EARLY = existsSync(NEW_STABLE_DIR) || !existsSync(LEGACY_STABLE_DIR)
  ? NEW_STABLE_DIR
  : LEGACY_STABLE_DIR;
const HISTORICAL_LOG = join(STABLE_DIR_EARLY, "historical.log");

try { mkdirSync(STABLE_DIR_EARLY, { recursive: true }); } catch {}
try {
  if (existsSync(HISTORICAL_LOG) && statSync(HISTORICAL_LOG).size > 1_000_000) {
    truncateSync(HISTORICAL_LOG, 0);
  }
} catch {}

const ts = () => new Date().toISOString();
const log = (msg) => {
  const line = `[${ts()}] ${msg}\n`;
  try { appendFileSync(HISTORICAL_LOG, line); } catch {}
};

async function loadApiKey() {
  if (process.env.USAGE_TRACKER_API_KEY) return process.env.USAGE_TRACKER_API_KEY;
  try {
    const newFile = join(homedir(), ".z21labs", "usage-key");
    if (existsSync(newFile)) return readFileSync(newFile, "utf8").trim();
    const legacyFile = join(homedir(), ".primus-usage-key");
    if (existsSync(legacyFile)) return readFileSync(legacyFile, "utf8").trim();
  } catch {}
  return null;
}

// 사용자 로컬 timezone 기준 YYYY-MM-DD 추출.
function ymdInTz(date, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// 로컬 기준 "오늘" 의 ISO Monday (월요일) 반환.
function isoMondayOf(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay();          // 0=Sun, 1=Mon, ...
  const distance = (dow + 6) % 7;       // Mon=0, Sun=6
  utc.setUTCDate(utc.getUTCDate() - distance);
  return utc.toISOString().slice(0, 10);
}

function shiftDays(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function shiftMonths(ymd, months) {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCMonth(utc.getUTCMonth() + months);
  return utc.toISOString().slice(0, 10);
}

function lastDayOfMonth(firstOfMonth) {
  const next = shiftMonths(firstOfMonth, 1);
  return shiftDays(next, -1);
}

function spawnCodeburnRange(provider, fromYmd, toYmd) {
  return new Promise((resolve) => {
    const chunks = [];
    const proc = spawn(
      "codeburn",
      ["report", "--from", fromYmd, "--to", toYmd, "--format", "json", "--provider", provider],
      { stdio: ["ignore", "pipe", "pipe"], shell: true, env: childEnv }
    );
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch { resolve(null); }
    });
    proc.on("error", () => resolve(null));
    setTimeout(() => { proc.kill(); resolve(null); }, 600_000);
  });
}

// ccusage daily 일별 토큰 분해 (--since / --until 은 YYYYMMDD 형식).
// historical snapshot 의 DAILY ACTIVITY 토큰 차트가 비지 않게 임베드.
// Multi-provider: ccusage claude/codex sub-command.
function spawnCcusageRange(provider, fromYmd, toYmd) {
  return new Promise((resolve) => {
    const since = fromYmd.replace(/-/g, "");
    const until = toYmd.replace(/-/g, "");
    const chunks = [];
    const proc = spawn(
      "ccusage",
      [provider, "daily", "--since", since, "--until", until, "--json"],
      { stdio: ["ignore", "pipe", "pipe"], shell: true, env: childEnv }
    );
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch { resolve(null); }
    });
    proc.on("error", () => resolve(null));
    setTimeout(() => { proc.kill(); resolve(null); }, 600_000);
  });
}

// 빈 period 판정. cost=0 && calls=0 이면 그 기간엔 활동 없음 — drop.
function isEmpty(json) {
  const cost = Number(json?.overview?.cost ?? 0);
  const calls = Number(json?.overview?.calls ?? 0);
  return cost === 0 && calls === 0;
}

// Multi-provider: 양쪽 provider 각각 codeburn + ccusage 호출. 빈 결과 (Codex 안 쓰는
// 사용자) 는 isEmpty 로 drop. 결과는 provider 별 entry 배열로 반환.
async function fetchOnePeriod(start, end, label) {
  const results = [];
  for (const provider of PROVIDERS) {
    const json = await spawnCodeburnRange(provider, start, end);
    if (!json || !json.overview) {
      log(`${label} ${provider}: codeburn fetch failed`);
      continue;
    }
    if (isEmpty(json)) {
      log(`${label} ${provider}: empty period (cost=0/calls=0) — skip`);
      continue;
    }
    const ccu = await spawnCcusageRange(provider, start, end);
    if (ccu) {
      json.ccusageDaily = ccu;
    } else {
      log(`${label} ${provider}: ccusage fetch failed (codeburn 만 임베드)`);
    }
    results.push({ provider, rawJson: json });
  }
  return results;
}

async function generateSnapshots() {
  const today = ymdInTz(new Date(), SYSTEM_TZ);
  const thisWeekStart = isoMondayOf(today);
  const thisMonthStart = today.slice(0, 7) + "-01";

  const snapshots = [];

  // 지난 8주 (이번 주 제외)
  for (let i = 1; i <= 8; i++) {
    const start = shiftDays(thisWeekStart, -7 * i);
    const end = shiftDays(start, 6);
    const label = `weekly ${start}~${end}`;
    log(label);
    const results = await fetchOnePeriod(start, end, label);
    for (const { provider, rawJson } of results) {
      snapshots.push({ type: "weekly", periodStart: start, provider, rawJson });
    }
  }

  // 지난 12개월 (이번 달 제외)
  for (let i = 1; i <= 12; i++) {
    const start = shiftMonths(thisMonthStart, -i);
    const end = lastDayOfMonth(start);
    const label = `monthly ${start}~${end}`;
    log(label);
    const results = await fetchOnePeriod(start, end, label);
    for (const { provider, rawJson } of results) {
      snapshots.push({ type: "monthly", periodStart: start, provider, rawJson });
    }
  }

  return snapshots;
}

async function postTo(dest, snapshots) {
  const headers = { "Content-Type": "application/json" };
  if (dest.apiKey) headers["x-api-key"] = dest.apiKey;
  try {
    const resp = await fetch(`${dest.url}/api/ingest/historical`, {
      method: "POST",
      headers,
      body: JSON.stringify({ snapshots }),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      log(`✅ ${dest.name} (${dest.url}): inserted=${data?.inserted ?? "?"} skipped=${data?.skipped ?? "?"}`);
      return true;
    }
    log(`❌ ${dest.name} (${dest.url}): POST failed ${resp.status}`);
    return false;
  } catch (err) {
    log(`❌ ${dest.name} (${dest.url}): ${err?.message ?? err}`);
    return false;
  }
}

async function main() {
  log("historical backfill start");
  try {
    const destinations = await loadDestinations();
    // apiKey 가 필요한 cloud destination (localhost 가 아닌 URL) 에 apiKey 없으면 skip.
    const usable = destinations.filter((d) => {
      const isLocal = /localhost|127\.0\.0\.1/.test(d.url);
      return isLocal || d.apiKey;
    });
    if (usable.length === 0) {
      log("no usable destinations (apiKey 없음 + local destination 도 없음) — skip");
      return;
    }
    const snapshots = await generateSnapshots();
    log(`generated ${snapshots.length} snapshots → ${usable.map((d) => d.name).join(", ")}`);
    if (snapshots.length === 0) {
      log("no snapshots to send");
      return;
    }
    await Promise.all(usable.map((d) => postTo(d, snapshots)));
  } catch (err) {
    log(`ERROR: ${err?.message ?? err}`);
  }
}

main();
