// schema.ts (PG) vs schema-sqlite.ts (SQLite) 의 table·column drift 검출.
//
// 배경: Phase 4.2 M6a/c 의 multi-tenant 마이그가 PG 만 작성되어 SQLite 가
// broken 상태로 운영되었음 (LOCAL_MODE dev 환경 검증으로 발견). 이번 fix 이후
// 새 PG schema 변경마다 SQLite 도 동시 작성 필요 — 사람이 잊으면 같은 사고.
//
// 이 스크립트는 두 schema 파일의 export 된 table 이름 set + 각 table 의 column
// 이름 set 을 비교. SQLite 에 의도적으로 없는 table (invitations / join_requests /
// api_tokens / audit_logs — cloud 전용) 은 IGNORED 에 명시.
//
// 사용:
//   node scripts/check-schema-sync.mjs
//   exit 0 = 동기화 OK, exit 1 = drift 검출 + 차이 출력
//
// 향후 pre-commit 또는 CI 에 묶을 수 있음.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PG_FILE = path.resolve(__dirname, "..", "src", "lib", "db", "schema.ts");
const SQLITE_FILE = path.resolve(__dirname, "..", "src", "lib", "db", "schema-sqlite.ts");

// SQLite 에 의도적으로 없는 cloud-only table. 이 list 가 너무 커지면 LOCAL_MODE
// 자체를 deprecate 검토.
const SQLITE_IGNORED = new Set([
  "invitations",
  "joinRequests",
  "apiTokens",
  "auditLogs",
  "suggestions",
  "ccusageCompatRuns",
  "cliCompatNotifications",
]);

// 마찬가지로 PG 에 없는 SQLite-only table (현재 없음). 미래용.
const PG_IGNORED = new Set();

/**
 * Drizzle schema 파일에서 `export const <name> = pgTable("…", { … })` 또는
 * `sqliteTable("…", { … })` 의 정의를 정규식으로 파싱.
 * 반환: Map<exportName, { tableName: string, columns: Set<jsColName> }>
 *
 * 정확한 AST 파서 아니지만, drizzle 정의가 패턴화돼 있어 정규식으로 충분.
 */
function parseDrizzleSchema(src) {
  const tables = new Map();

  // export const <name> = <type>Table(\n? "<table>", { ... }, \n? (t) => ({...})\n? );
  // multi-line + nested braces 지원 위해 balanced parsing.
  const exportRe = /export\s+const\s+(\w+)\s*=\s*(?:pgTable|sqliteTable)\s*\(\s*"([^"]+)"\s*,\s*\{/g;
  let m;
  while ((m = exportRe.exec(src)) !== null) {
    const exportName = m[1];
    const startBrace = m.index + m[0].length - 1; // { 위치
    // balanced brace matching for the column object literal
    let depth = 1;
    let i = startBrace + 1;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    const colBody = src.slice(startBrace + 1, i - 1);

    // columns — `<jsName>: integer("<dbName>"...)` 또는 `<jsName>: text(...)` 등.
    // jsName 만 추출 (dbName 은 검증 외 — 다만 dbName 도 추출 가능, 후속).
    const colRe = /(\w+)\s*:\s*(?:integer|text|real|jsonb|json|timestamp|date|inet|serial|boolean|bigint)\s*\(/g;
    const columns = new Set();
    let c;
    while ((c = colRe.exec(colBody)) !== null) {
      columns.add(c[1]);
    }
    tables.set(exportName, { tableName: m[2], columns });
  }
  return tables;
}

const pgSrc = readFileSync(PG_FILE, "utf8");
const sqSrc = readFileSync(SQLITE_FILE, "utf8");

const pgTables = parseDrizzleSchema(pgSrc);
const sqTables = parseDrizzleSchema(sqSrc);

const errors = [];

// 1) table 이름 drift
for (const [name] of pgTables) {
  if (SQLITE_IGNORED.has(name)) continue;
  if (!sqTables.has(name)) {
    errors.push(`✗ ${name}: schema.ts 에 있지만 schema-sqlite.ts 에 누락`);
  }
}
for (const [name] of sqTables) {
  if (PG_IGNORED.has(name)) continue;
  if (!pgTables.has(name)) {
    errors.push(`✗ ${name}: schema-sqlite.ts 에 있지만 schema.ts 에 누락`);
  }
}

// 2) column drift (양쪽 다 있는 table 만)
for (const [name, pgT] of pgTables) {
  if (SQLITE_IGNORED.has(name)) continue;
  const sqT = sqTables.get(name);
  if (!sqT) continue;
  for (const col of pgT.columns) {
    if (!sqT.columns.has(col)) {
      errors.push(`✗ ${name}.${col}: PG 에 있지만 SQLite 에 누락`);
    }
  }
  for (const col of sqT.columns) {
    if (!pgT.columns.has(col)) {
      errors.push(`✗ ${name}.${col}: SQLite 에 있지만 PG 에 누락`);
    }
  }
}

if (errors.length === 0) {
  console.log("[check-schema-sync] ✓ schema.ts ↔ schema-sqlite.ts 동기화 OK");
  console.log(`  PG tables: ${pgTables.size} / SQLite tables: ${sqTables.size} (cloud-only ${SQLITE_IGNORED.size} ignored)`);
  process.exit(0);
}

console.error("[check-schema-sync] ✗ drift 검출:");
for (const e of errors) console.error(`  ${e}`);
console.error("");
console.error("  → schema-sqlite.ts 도 동일하게 갱신 + drizzle-sqlite 마이그 작성 필요.");
console.error("  → 의도적으로 SQLite 에 없는 cloud-only table 이면 SQLITE_IGNORED 에 추가.");
process.exit(1);
