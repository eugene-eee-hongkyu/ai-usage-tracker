import * as vscode from "vscode";
import { StatusBar } from "./statusBar";
import { isSetupComplete } from "./extension";

function getConfig() {
  const cfg = vscode.workspace.getConfiguration("aiUsageTracker");
  return {
    serverUrl: cfg.get<string>("serverUrl") ?? "https://aiusage.z21labs.world",
    githubRepo: cfg.get<string>("githubRepo") ?? "github:eugene-eee-hongkyu/ai-usage-tracker",
  };
}

// Integrated Terminal 에서 cli 명령 실행. 사용자가 결과를 직접 보고
// preflight 자동 복구 prompt (Y/n) 같은 인터랙션도 가능.
function runInTerminal(name: string, command: string, statusBar: StatusBar, label: string): void {
  statusBar.setBusy(label);
  const terminal = vscode.window.createTerminal({ name });
  terminal.show();
  terminal.sendText(command);

  // 명령 자체의 exit 감지는 어려움 (terminal API 제약). 10초 후 상태 재확인.
  setTimeout(() => statusBar.refresh(isSetupComplete()), 10_000);
}

export function registerCommands(context: vscode.ExtensionContext, statusBar: StatusBar): void {
  const { serverUrl, githubRepo } = getConfig();

  context.subscriptions.push(
    vscode.commands.registerCommand("aiUsageTracker.setup", () => {
      runInTerminal(
        "AI Usage Tracker: Setup",
        `npx --yes ${githubRepo} init`,
        statusBar,
        "setup",
      );
    }),

    vscode.commands.registerCommand("aiUsageTracker.repair", () => {
      runInTerminal(
        "AI Usage Tracker: Repair",
        `npx --yes ${githubRepo} repair`,
        statusBar,
        "repair",
      );
    }),

    vscode.commands.registerCommand("aiUsageTracker.doctor", () => {
      runInTerminal(
        "AI Usage Tracker: Doctor",
        `npx --yes ${githubRepo} doctor`,
        statusBar,
        "doctor",
      );
    }),

    vscode.commands.registerCommand("aiUsageTracker.openDashboard", () => {
      void vscode.env.openExternal(vscode.Uri.parse(`${serverUrl}/dashboard`));
    }),

    vscode.commands.registerCommand("aiUsageTracker.openSetupStatus", () => {
      void vscode.env.openExternal(vscode.Uri.parse(`${serverUrl}/setup-status`));
    }),

    vscode.commands.registerCommand("aiUsageTracker.showMenu", async () => {
      const installed = isSetupComplete();

      const items: Array<vscode.QuickPickItem & { id: string }> = installed
        ? [
            { id: "openDashboard", label: "$(graph) 대시보드 열기", description: "내 효율 점수·90일 잔디·팀 비교" },
            { id: "openSetupStatus", label: "$(checklist) 셋업 상태", description: "마지막 sync 시각·환경 진단 카드" },
            { id: "repair", label: "$(wrench) 복구 (Repair)", description: "API 키 유지, hook + 패키지 재등록" },
            { id: "doctor", label: "$(pulse) 환경 진단 (Doctor)", description: "Node·npm·codeburn·ccusage 상태" },
          ]
        : [
            { id: "setup", label: "$(rocket) 설치 (Setup)", description: "최초 설치 — OAuth + hook 등록" },
            { id: "doctor", label: "$(pulse) 환경 진단 (Doctor)", description: "현재 시스템 상태 확인" },
            { id: "openSetupStatus", label: "$(checklist) 셋업 가이드", description: "웹에서 설치 안내 보기" },
          ];

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: installed ? "AI Usage Tracker — 메뉴" : "AI Usage Tracker — 아직 설치되지 않았습니다",
      });
      if (!picked) return;
      void vscode.commands.executeCommand(`aiUsageTracker.${picked.id}`);
    }),
  );
}
