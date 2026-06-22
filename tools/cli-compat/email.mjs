// verify(실측 구조) + release-notes(값 변동 힌트) 를 합쳐 사람이 바로 이해하는 이메일을
// HTML + plaintext 로 조립한다. markdown 안 씀(이메일이 렌더 못 함).
//
// 판정:
//   broken — verify 가 critical 필드 깨짐 감지 → 🔴 파싱 수정 필요
//   value  — 구조 안전인데 값 변동 힌트 있음   → 🟡 핀 업 OK, 단 숫자 달라질 수 있음
//   safe   — 구조 안전 + 값 변동 힌트 없음      → ✅ 기존 파라미터로 동일, 안전

import { CONTRACT } from "./manifest.mjs";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// manifest 에서 "우리가 쓰는 방식" 요약 추출
function contractSummary(pkgKey) {
  const meta = CONTRACT[pkgKey];
  const commands = meta.probes.map((p) => `${meta.npm} ${p.argv.join(" ")}`);
  const fieldSet = new Set();
  for (const p of meta.probes) {
    for (const f of p.rowFields ?? []) fieldSet.add(f.name);
    for (const f of p.objectFields ?? []) fieldSet.add(f.path);
  }
  return { commands, fields: [...fieldSet] };
}

function decideVerdict(verify, notes) {
  if (verify.verdict === "structure-broken") return "broken";
  if ((notes.value?.length ?? 0) > 0 || (notes.structural?.length ?? 0) > 0) return "value";
  return "safe";
}

const VERDICT_META = {
  broken: { color: "#dc2626", label: "🔴 구조 변경 — 파싱 수정 필요" },
  value:  { color: "#d97706", label: "🟡 구조 안전 · 저장 값 변동 가능" },
  safe:   { color: "#16a34a", label: "✅ 안전 — 기존 파라미터로 데이터 동일" },
};

function recommend(verdict, pkgKey) {
  if (verdict === "broken") {
    return [
      `아래 "구조 변경" 항목의 필드를 우리 파싱 코드(web/src/lib/sync/run-ingest.ts · ccusage-row.ts)에서 고쳐야 합니다.`,
      `안 고치고 핀만 올리면 그 값이 0/누락으로 저장됩니다.`,
      `수정 후 다시 이 검사가 통과(structure-safe)하면 핀(web/src/lib/pinned-versions.ts)을 올리세요.`,
    ];
  }
  if (verdict === "value") {
    return [
      `우리가 읽는 명령·필드 구조는 그대로입니다(실측 확인) — 파싱 수정 불필요.`,
      `단 아래 "값 변동 가능" 때문에 대시보드의 비용·토큰·세션 숫자가 이전과 조금 달라질 수 있습니다(대개 정확도 향상 방향).`,
      `그게 괜찮으면 핀(web/src/lib/pinned-versions.ts)을 올리면 됩니다.`,
    ];
  }
  return [
    `우리가 읽는 명령·필드가 그대로이고 값에 영향 주는 변경도 없습니다.`,
    `핀(web/src/lib/pinned-versions.ts)만 올리면 됩니다 — 가져오는 데이터가 동일합니다.`,
  ];
}

export function composeEmail({ pkg, from, to, verify, notes }) {
  const verdict = decideVerdict(verify, notes);
  const vm = VERDICT_META[verdict];
  const c = contractSummary(pkg);
  const subject = `[CLI 호환성] ${pkg} ${from} → ${to} — ${vm.label}`;

  const breaking = verify.breaking ?? [];
  const valueHints = notes.value ?? [];
  const structHints = notes.structural ?? [];
  const neutral = notes.neutral ?? [];
  const softWarn = (verify.warnings ?? []).filter((w) => w.severity === "soft");
  const probeErrors = verify.probeErrors ?? [];

  // ---------- plaintext ----------
  const T = [];
  T.push(`${pkg} ${from} → ${to}`);
  T.push(`판정: ${vm.label}`);
  T.push("");
  T.push("[ 우리가 쓰는 방식 ]");
  for (const cmd of c.commands) T.push(`  명령: ${cmd}`);
  T.push(`  읽는 필드: ${c.fields.join(", ")}`);
  T.push("");
  T.push("[ 이번 변경이 그걸 건드리나? ]");
  T.push("  [구조 변경 — 명령/필드] (실측):");
  if (breaking.length === 0) T.push("    없음 — 출력 키·옵션 그대로 (핀/최신 둘 다 실행해 대조함)");
  else for (const b of breaking) T.push(`    🔴 [${b.probe}] ${b.field}: ${b.detail}`);
  if (structHints.length) {
    T.push("    릴리즈 노트상 구조 관련 언급(참고 — 실측은 위 결과가 확정):");
    for (const s of structHints) T.push(`      · (${s.version}) ${s.text}`);
  }
  T.push("");
  T.push("  [값 변동 가능 — 구조는 같으나 숫자가 달라질 수 있음]:");
  if (valueHints.length === 0) T.push("    없음");
  else for (const v of valueHints) T.push(`    · (${v.version}) ${v.text}`);
  T.push("");
  if (neutral.length) {
    T.push(`  [무관 — 성능/CI/빌드 등] ${neutral.length}건 (참고용, 생략)`);
    T.push("");
  }
  if (softWarn.length || probeErrors.length) {
    T.push("  [검증 못 한 항목] (조용히 통과 아님):");
    for (const w of softWarn) T.push(`    · ${w.field}: ${w.detail}`);
    for (const e of probeErrors) T.push(`    · ${e.probe}: ${e.error}`);
    T.push("");
  }
  T.push("[ 권장 조치 ]");
  recommend(verdict, pkg).forEach((r, i) => T.push(`  ${i + 1}. ${r}`));
  T.push("");
  T.push("— 자동 생성: GitHub Actions cli-compat-check (핀 vs 최신 실측 구조 검사 + 릴리즈 노트 분류)");
  const text = T.join("\n");

  // ---------- HTML ----------
  const li = (s) => `<li style="margin:2px 0">${s}</li>`;
  const sec = (title) => `<h3 style="margin:20px 0 6px;font-size:14px;color:#0f172a">${title}</h3>`;
  const breakingHtml = breaking.length === 0
    ? `<p style="margin:4px 0;color:#16a34a">없음 — 출력 키·옵션 그대로 (핀/최신 둘 다 실행해 대조)</p>`
    : `<ul style="margin:4px 0;padding-left:18px">${breaking.map((b) => li(`<strong style="color:#dc2626">[${esc(b.probe)}] ${esc(b.field)}</strong> — ${esc(b.detail)}`)).join("")}</ul>`;
  const structHtml = structHints.length
    ? `<p style="margin:6px 0 2px;font-size:12px;color:#64748b">릴리즈 노트상 구조 관련 언급(참고 — 실측이 확정):</p><ul style="margin:0 0 0;padding-left:18px;color:#64748b;font-size:12px">${structHints.map((s) => li(`(${esc(s.version)}) ${esc(s.text)}`)).join("")}</ul>` : "";
  const valueHtml = valueHints.length === 0
    ? `<p style="margin:4px 0;color:#475569">없음</p>`
    : `<ul style="margin:4px 0;padding-left:18px">${valueHints.map((v) => li(`<span style="color:#94a3b8">(${esc(v.version)})</span> ${esc(v.text)}`)).join("")}</ul>`;
  const neutralHtml = neutral.length
    ? `${sec(`⚪ 무관 (성능/CI/빌드 등) — ${neutral.length}건`)}<details><summary style="cursor:pointer;color:#64748b;font-size:12px">펼치기</summary><ul style="margin:4px 0;padding-left:18px;color:#64748b;font-size:12px">${neutral.map((n) => li(`(${esc(n.version)}) ${esc(n.text)}`)).join("")}</ul></details>` : "";
  const softHtml = (softWarn.length || probeErrors.length)
    ? `${sec("ℹ️ 검증 못 한 항목 (조용히 통과 아님)")}<ul style="margin:4px 0;padding-left:18px;color:#64748b;font-size:12px">${softWarn.map((w) => li(`${esc(w.field)}: ${esc(w.detail)}`)).join("")}${probeErrors.map((e) => li(`${esc(e.probe)}: ${esc(e.error)}`)).join("")}</ul>` : "";

  const html = `<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;max-width:680px;margin:32px auto;padding:24px;color:#0f172a;line-height:1.55">
  <h2 style="margin:0 0 4px">${esc(pkg)} <span style="color:#475569;font-weight:500">${esc(from)} → ${esc(to)}</span></h2>
  <div style="display:inline-block;margin:6px 0 8px;padding:4px 12px;border-radius:6px;background:${vm.color};color:#fff;font-size:13px;font-weight:600">${esc(vm.label)}</div>

  ${sec("■ 우리가 쓰는 방식")}
  <ul style="margin:4px 0;padding-left:18px;font-size:13px">
    ${c.commands.map((cmd) => li(`명령: <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">${esc(cmd)}</code>`)).join("")}
    ${li(`읽는 필드: <span style="color:#475569">${esc(c.fields.join(", "))}</span>`)}
  </ul>

  ${sec("■ 이번 변경이 그걸 건드리나?")}
  <p style="margin:8px 0 2px;font-weight:600">🔴 구조 변경 (명령·필드) — 실측</p>
  ${breakingHtml}
  ${structHtml}
  <p style="margin:12px 0 2px;font-weight:600">🟡 값 변동 가능 (구조는 같으나 숫자가 달라질 수 있음)</p>
  ${valueHtml}
  ${neutralHtml}
  ${softHtml}

  ${sec("■ 권장 조치")}
  <ol style="margin:4px 0;padding-left:18px;font-size:13px">${recommend(verdict, pkg).map((r) => li(esc(r))).join("")}</ol>

  <p style="font-size:11px;color:#94a3b8;margin-top:24px">자동 생성: GitHub Actions <code>cli-compat-check</code> · 핀 vs 최신 <strong>실측 구조 검사</strong> + 릴리즈 노트 분류</p>
  </body></html>`;

  return { subject, html, text, verdict };
}
