// cli-compat 안전 게이트 — 핀 버전과 npm latest 를 둘 다 격리 설치해 실제로 돌리고,
// 우리가 소비하는 필드(manifest.mjs)가 구조적으로 유지되는지 대조한다.
//
// "릴리즈 노트 산문"이 아니라 "실제 출력 JSON 의 키/타입"을 보므로 false negative 없음
// (date→period 같은 회귀를 확실히 잡는다). 값(숫자) 변동은 보지 않는다.
//
// 실행: node tools/cli-compat/verify.mjs            (전체)
//       node tools/cli-compat/verify.mjs ccusage    (한 패키지)
//       FROM_OVERRIDE=20.0.6 TO_OVERRIDE=20.0.14 node tools/cli-compat/verify.mjs ccusage
//
// 출력: stdout = 결과 JSON (GH Action·이메일 스크립트가 소비), stderr = 사람용 로그.
// 바이너리 실행이 필요해 Vercel cron 불가 → GitHub Actions(또는 로컬)에서 실행.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTRACT, PINNED_FILE } from "./manifest.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const FIXTURES = join(HERE, "fixtures");

function log(...a) { console.error(...a); }

function readPinned(pinKey) {
  const src = readFileSync(join(REPO_ROOT, PINNED_FILE), "utf8");
  const m = src.match(new RegExp(`${pinKey}\\s*:\\s*"([^"]+)"`));
  if (!m) throw new Error(`핀 값 못 찾음: ${pinKey} in ${PINNED_FILE}`);
  return m[1];
}

async function fetchLatest(npm) {
  const res = await fetch(`https://registry.npmjs.org/${npm}/latest`);
  if (!res.ok) throw new Error(`npm registry fetch 실패 (${npm}): ${res.status}`);
  return (await res.json()).version;
}

export function cmpVer(a, b) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function installInto(prefix, npm, ver) {
  execFileSync("npm", ["i", "--prefix", prefix, `${npm}@${ver}`,
    "--no-save", "--no-audit", "--no-fund", "--loglevel=error"],
    { stdio: ["ignore", "ignore", "inherit"] });
  const bin = join(prefix, "node_modules", ".bin", npm);
  if (!existsSync(bin)) throw new Error(`설치 후 바이너리 없음: ${bin}`);
  return bin;
}

function runProbe(bin, argv, homeDir) {
  const out = execFileSync(bin, argv, {
    env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir, NO_COLOR: "1" },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v; // number/string/object/boolean/undefined
}

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// row(객체) 에서 동의어 키 중 하나가 올바른 타입으로 존재하는가
function evalRowField(row, f) {
  const keys = f.synonyms ?? [f.name];
  const types = Array.isArray(f.type) ? f.type : [f.type];
  for (const k of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, k)) {
      const t = typeOf(row[k]);
      return types.includes(t) ? { ok: true, via: k, type: t } : { ok: false, via: k, type: t, reason: "type" };
    }
  }
  return { ok: false, reason: "missing", expected: keys };
}

// 객체에서 동의어 dot-path 중 하나가 올바른 타입으로 존재하는가
function evalObjField(out, f) {
  const paths = f.synonyms ?? [f.path];
  const types = Array.isArray(f.type) ? f.type : [f.type];
  for (const p of paths) {
    const v = getPath(out, p);
    if (v !== undefined) {
      const t = typeOf(v);
      return types.includes(t) ? { ok: true, via: p, type: t } : { ok: false, via: p, type: t, reason: "type" };
    }
  }
  return { ok: false, reason: "missing", expected: paths };
}

function describe(f) {
  return f.name ?? f.path;
}

// pinned 에서는 통과하는데 latest 에서 깨지면 breaking. pinned 에서도 실패하면 fixture/manifest 경고.
function diffField(f, evalFn, outPin, outLatest, rowPin, rowLatest) {
  const pin = evalFn === evalRowField ? evalFn(rowPin, f) : evalFn(outPin, f);
  const lat = evalFn === evalRowField ? evalFn(rowLatest, f) : evalFn(outLatest, f);
  if (!pin.ok) {
    return { field: describe(f), severity: f.severity, kind: "baseline-miss",
             detail: `핀(${outPin.__ver}) 출력에도 없음(${pin.reason}) — fixture/manifest 점검 필요`, pin, lat };
  }
  if (lat.ok) return null; // 정상 유지
  return { field: describe(f), severity: f.severity, kind: "broken",
           detail: lat.reason === "type"
             ? `타입 변경: ${pin.via}(${pin.type}) → ${lat.via}(${lat.type})`
             : `필드 사라짐: ${(lat.expected || []).join(" | ")} 중 어느 것도 없음`, pin, lat };
}

export async function verifyPackage(pkgKey, fromOverride, toOverride) {
  const meta = CONTRACT[pkgKey];
  const from = fromOverride ?? readPinned(meta.pinKey);
  const to = toOverride ?? (await fetchLatest(meta.npm));

  if (cmpVer(from, to) >= 0) {
    return { pkg: pkgKey, from, to, changed: false, verdict: "up-to-date" };
  }

  log(`\n[${pkgKey}] ${from} → ${to} — 격리 설치 후 구조 대조`);
  const prefixPin = mkdtempSync(join(tmpdir(), `clic-${pkgKey}-pin-`));
  const prefixLat = mkdtempSync(join(tmpdir(), `clic-${pkgKey}-lat-`));
  const breaking = [];
  const warnings = [];
  const probeErrors = [];

  try {
    const binPin = installInto(prefixPin, meta.npm, from);
    const binLat = installInto(prefixLat, meta.npm, to);

    for (const probe of meta.probes) {
      const homeDir = join(FIXTURES, probe.home);
      let outPin, outLat;
      try {
        outPin = runProbe(binPin, probe.argv, homeDir);
        outLat = runProbe(binLat, probe.argv, homeDir);
        outPin.__ver = from; outLat.__ver = to;
      } catch (e) {
        probeErrors.push({ probe: `${pkgKey}/${probe.provider}`, error: e.message });
        continue;
      }

      // object-path 필드
      for (const f of probe.objectFields ?? []) {
        const d = diffField(f, evalObjField, outPin, outLat);
        if (d) (d.kind === "broken" && d.severity === "critical" ? breaking : warnings).push({ probe: probe.provider, ...d });
      }

      // row 필드
      if (probe.rows) {
        const rowsPin = getPath(outPin, probe.rows.path) ?? [];
        const rowsLat = getPath(outLat, probe.rows.path) ?? [];
        if (rowsPin.length < (probe.rows.min ?? 0)) {
          if ((probe.rows.min ?? 0) > 0) {
            warnings.push({ probe: probe.provider, field: probe.rows.path, severity: "soft",
              kind: "no-rows", detail: `핀 출력 ${probe.rows.path}[] 가 비어 fixture 검증 불가 (${probe.provider})` });
          }
          continue;
        }
        const rowPin = rowsPin[0];
        const rowLat = rowsLat[0] ?? {};
        for (const f of probe.rowFields ?? []) {
          const d = diffField(f, evalRowField, outPin, outLat, rowPin, rowLat);
          if (d) (d.kind === "broken" && d.severity === "critical" ? breaking : warnings).push({ probe: probe.provider, ...d });
        }
      }
    }
  } finally {
    rmSync(prefixPin, { recursive: true, force: true });
    rmSync(prefixLat, { recursive: true, force: true });
  }

  const structureSafe = breaking.length === 0 && probeErrors.length === 0;
  return {
    pkg: pkgKey, from, to, changed: true,
    verdict: structureSafe ? "structure-safe" : "structure-broken",
    breaking, warnings, probeErrors,
  };
}

async function main() {
  const only = process.argv[2];
  const fromOverride = process.env.FROM_OVERRIDE;
  const toOverride = process.env.TO_OVERRIDE;
  const pkgs = only ? [only] : Object.keys(CONTRACT);
  const results = [];
  for (const p of pkgs) {
    if (!CONTRACT[p]) throw new Error(`알 수 없는 패키지: ${p}`);
    results.push(await verifyPackage(p, fromOverride, toOverride));
  }
  for (const r of results) {
    if (!r.changed) { log(`[${r.pkg}] ${r.from} = latest — 변경 없음`); continue; }
    log(`[${r.pkg}] ${r.from} → ${r.to}: ${r.verdict}` +
        (r.breaking?.length ? ` · 🔴 breaking ${r.breaking.length}` : "") +
        (r.warnings?.length ? ` · ⚠️ warn ${r.warnings.length}` : "") +
        (r.probeErrors?.length ? ` · ❌ probeError ${r.probeErrors.length}` : ""));
    for (const b of r.breaking ?? []) log(`   🔴 [${b.probe}] ${b.field}: ${b.detail}`);
    for (const w of r.warnings ?? []) log(`   ⚠️ [${w.probe}] ${w.field}: ${w.detail}`);
    for (const e of r.probeErrors ?? []) log(`   ❌ ${e.probe}: ${e.error}`);
  }
  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
}

// 직접 실행될 때만 main (import 되면 verifyPackage/cmpVer 만 노출)
if (process.argv[1] && process.argv[1].endsWith("verify.mjs")) {
  main().catch((e) => { log("FATAL:", e.message); process.exit(1); });
}
