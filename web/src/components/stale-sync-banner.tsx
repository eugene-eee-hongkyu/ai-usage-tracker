"use client";

import { useState } from "react";
import { useMessages } from "@/lib/use-i18n";

// 본인 dashboard 상단에 표시. launchd 가 깨졌는데 본인이 모르는 만성 문제를
// 자가 발견할 수 있도록. 24h 초과 시 노랑, 72h 초과 시 빨강. 복구 명령 한 줄
// 같이 노출. viewOnly (남의 dashboard) / isLocalMode (.dmg) 일 땐 안 보임.

const REPAIR_CMD = "npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair";

function tmpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function StaleSyncBanner({
  lastSyncedAt,
  hidden,
}: {
  lastSyncedAt: string | null;
  hidden: boolean;
}) {
  const { m } = useMessages();
  const [copied, setCopied] = useState(false);

  if (hidden || !lastSyncedAt) return null;

  const ageMs = Date.now() - new Date(lastSyncedAt).getTime();
  const ageHours = Math.floor(ageMs / 3600_000);
  if (ageHours < 24) return null;

  const severe = ageHours >= 72;
  const borderColor = severe ? "border-red-700/60" : "border-amber-600/60";
  const bgColor = severe ? "bg-red-950/40" : "bg-amber-950/40";
  const textColor = severe ? "text-red-200" : "text-amber-200";
  const titleKey = m.dashboardView.staleSyncTitle;
  const body = tmpl(m.dashboardView.staleSyncBody, { n: ageHours });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(REPAIR_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className={`max-w-7xl mx-auto px-4 mt-3`}>
      <div className={`border ${borderColor} ${bgColor} rounded-lg p-3 flex flex-col gap-2`}>
        <div className="flex items-start gap-3">
          <span className={`${textColor} font-semibold text-sm`}>● {titleKey}</span>
          <span className="text-neutral-300 text-sm">{body}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-neutral-400">{m.dashboardView.staleSyncRepairLabel}</span>
          <code className="text-xs bg-neutral-900 px-2 py-1 rounded text-neutral-200 font-mono break-all">
            {REPAIR_CMD}
          </code>
          <button
            onClick={copy}
            className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
          >
            {copied ? m.dashboardView.staleSyncCopied : m.dashboardView.staleSyncCopy}
          </button>
        </div>
      </div>
    </div>
  );
}
