#!/usr/bin/env node
import { Command } from "commander";
import { runInit, runRepair, CLI_VERSION } from "./init.js";
import { runReset } from "./reset.js";
import { runSync } from "./sync.js";
import { runDoctor } from "./doctor.js";

const program = new Command();

program
  .name("usage-tracker")
  .description("Primus Labs Claude Code usage tracker")
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

// Default command when run as `npx ... init` (positional)
if (process.argv[2] === "init" || process.argv.length <= 2) {
  program.parse(["node", "usage-tracker", "init", ...process.argv.slice(3)]);
} else {
  program.parse(process.argv);
}
