#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./init.mjs";
import { runReset } from "./reset.mjs";
import { runSync } from "./sync.mjs";

const program = new Command();

program
  .name("ai-usage-tracker")
  .description("Primus Labs Claude Code usage tracker")
  .version("0.1.0");

program
  .command("init")
  .description("인증 및 SessionEnd hook 등록")
  .action(runInit);

program
  .command("reset")
  .description("API 키 재발급 및 재설정")
  .action(runReset);

program
  .command("sync")
  .description("과거 데이터 수동 동기화")
  .option("-d, --days <number>", "동기화할 일수", "90")
  .action((opts) => runSync(parseInt(opts.days)));

// Default to init when no subcommand given
if (!process.argv[2] || process.argv[2] === "init") {
  program.parse(["node", "ai-usage-tracker", "init", ...process.argv.slice(3)]);
} else {
  program.parse();
}
