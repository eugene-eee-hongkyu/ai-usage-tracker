"use client";

// 본인 dashboard 상단에 표시. selectedDevice 의 cliVersion 이 PINNED.USAGE_TRACKER_RECOMMENDED
// 미만이면 표시 — 사용자가 install.sh 를 다시 돌려 CLI 업데이트하도록 유도.
// viewOnly (남의 dashboard) / isLocalMode (.dmg installer 가 알아서 업데이트) 일 땐 안 보임.
// StaleSyncBanner (launchd 끊김) 과 별개 — 그쪽은 "CLI 가 안 돌고 있음", 이건 "CLI 가 옛 버전".

import { useState } from "react";

const REPAIR_CMD = "curl -fsSL https://aiusage.z21labs.world/install.sh | bash";
const REPAIR_CMD_WIN = "irm https://aiusage.z21labs.world/install.ps1 | iex";

export function CliUpdateBanner({
  outdated,
  currentVersion,
  recommendedVersion,
  platform,
  hidden,
}: {
  outdated: boolean;
  currentVersion: string | null;
  recommendedVersion: string;
  platform: string | null;
  hidden: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (hidden || !outdated || !currentVersion) return null;

  const cmd = platform === "win32" ? REPAIR_CMD_WIN : REPAIR_CMD;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 mt-3" data-testid="cli-update-banner">
      <div className="border border-indigo-700/60 bg-indigo-950/40 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex items-start gap-3 flex-wrap">
          <span className="text-indigo-200 font-semibold text-sm">↑ CLI 업데이트 가능</span>
          <span className="text-neutral-300 text-sm">
            현재 <code className="font-mono text-indigo-300">v{currentVersion}</code> — 권장 <code className="font-mono text-indigo-300">v{recommendedVersion}</code>. 아래 명령으로 재설치하세요.
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs bg-neutral-900 px-2 py-1 rounded text-neutral-200 font-mono break-all">
            {cmd}
          </code>
          <button
            onClick={copy}
            className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
          >
            {copied ? "복사됨 ✓" : "복사"}
          </button>
        </div>
      </div>
    </div>
  );
}
