#!/usr/bin/env node
import { Command } from "commander";
import { runInit, runRepair } from "./init.js";
import { runReset } from "./reset.js";
import { runSync } from "./sync.js";

const program = new Command();

program
  .name("usage-tracker")
  .description("Primus Labs Claude Code usage tracker")
  .version("0.1.0");

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

// Default command when run as `npx ... init` (positional)
if (process.argv[2] === "init" || process.argv.length <= 2) {
  program.parse(["node", "usage-tracker", "init", ...process.argv.slice(3)]);
} else {
  program.parse(process.argv);
}
