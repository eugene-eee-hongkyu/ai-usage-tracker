#!/usr/bin/env node
import { Command } from "commander";
import { runInit, runRepair, CLI_VERSION } from "./init.js";
import { runReset } from "./reset.js";
import { runSync } from "./sync.js";
import { runDoctor } from "./doctor.js";
import { runMigrate, printMigrateReport } from "./migrate.js";
import { runCompatCheck } from "./compat-check.js";

const program = new Command();

program
  .name("usage-tracker")
  .description("z21labs Claude Code usage tracker")
  .version(CLI_VERSION);

program
  .command("init")
  .description("인증 및 SessionEnd hook 등록")
  .action(runInit);

program
  .command("repair")
  .description("API 키 유지하고 hook·스케줄만 재등록")
  .action(runRepair);

program
  .command("reset")
  .description("API 키 재발급 및 재설정")
  .action(runReset);

program
  .command("sync")
  .description("과거 데이터 수동 동기화")
  .option("-d, --days <number>", "동기화할 일수", "90")
  .action((opts) => runSync(parseInt(opts.days)));

program
  .command("doctor")
  .description("환경 진단 — Node·npm·codeburn·ccusage·자동화 상태")
  .option("--json", "JSON 으로 출력 (머신 파싱용)")
  .action((opts) => runDoctor({ json: !!opts.json, cliVersion: CLI_VERSION }));

program
  .command("migrate")
  .description("primus → z21labs 마이그레이션 (옛 ~/.primus-usage-* → 새 ~/.z21labs/usage-*)")
  .option("--dry-run", "실제로 변경하지 않고 계획만 출력")
  .action(async (opts) => {
    const r = await runMigrate({ dryRun: !!opts.dryRun });
    printMigrateReport(r, !!opts.dryRun);
    if (r.errors.length > 0) process.exit(1);
  });

program
  .command("compat-check")
  .description("ccusage 현재 버전 vs 비교 대상 버전 raw daily 출력 업로드 (글로벌 ccusage 미변경)")
  .requiredOption("-t, --target <version>", "비교할 ccusage 버전 (예: 20.0.6) — latest 류 금지, 명시 버전만")
  .action((opts) => runCompatCheck({ target: opts.target }));

// Default command when run as `npx ... init` (positional)
if (process.argv[2] === "init" || process.argv.length <= 2) {
  program.parse(["node", "usage-tracker", "init", ...process.argv.slice(3)]);
} else {
  program.parse(process.argv);
}
