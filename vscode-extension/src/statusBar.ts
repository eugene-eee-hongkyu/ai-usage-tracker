import * as vscode from "vscode";

export class StatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "aiUsageTracker.showMenu";
    this.item.tooltip = "AI Usage Tracker — 클릭해서 메뉴 열기";
    this.item.show();
    this.setNotSetup();
  }

  refresh(installed: boolean): void {
    if (installed) {
      this.setActive();
    } else {
      this.setNotSetup();
    }
  }

  setActive(): void {
    this.item.text = "$(check) Usage Tracker";
    this.item.backgroundColor = undefined;
  }

  setNotSetup(): void {
    this.item.text = "$(circle-large-outline) Usage Tracker: Not setup";
    this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
  }

  setBusy(label: string): void {
    this.item.text = `$(loading~spin) Usage Tracker: ${label}`;
  }

  dispose(): void {
    this.item.dispose();
  }
}
