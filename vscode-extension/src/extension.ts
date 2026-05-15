import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { registerCommands } from "./commands";
import { StatusBar } from "./statusBar";

const STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
const API_KEY_FALLBACK = path.join(os.homedir(), ".primus-usage-key");
const FIRST_RUN_KEY = "aiUsageTracker.dismissedFirstRun";

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBar();
  context.subscriptions.push(statusBar);

  registerCommands(context, statusBar);

  // 상태 갱신 (설치 여부 감지)
  statusBar.refresh(isSetupComplete());

  // 첫 실행 안내 — 한 번만, 이후 dismissed flag 저장
  if (!isSetupComplete() && !context.globalState.get<boolean>(FIRST_RUN_KEY)) {
    void promptFirstRun(context);
  }

  // 주기적 상태 갱신 (5분마다 — 사용자가 외부에서 repair 한 경우 반영)
  const interval = setInterval(() => statusBar.refresh(isSetupComplete()), 5 * 60 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });
}

export function deactivate(): void {
  // no-op
}

export function isSetupComplete(): boolean {
  return fs.existsSync(STABLE_DIR) && fs.existsSync(API_KEY_FALLBACK);
}

async function promptFirstRun(context: vscode.ExtensionContext): Promise<void> {
  const action = await vscode.window.showInformationMessage(
    "AI Usage Tracker 가 설치되지 않은 상태입니다. 지금 설치할까요?",
    { modal: false },
    "지금 설치",
    "나중에",
    "다시 묻지 않기",
  );

  if (action === "지금 설치") {
    void vscode.commands.executeCommand("aiUsageTracker.setup");
  } else if (action === "다시 묻지 않기") {
    await context.globalState.update(FIRST_RUN_KEY, true);
  }
  // "나중에" 는 dismiss flag 안 저장 → 다음 활성화 시 다시 묻기
}
