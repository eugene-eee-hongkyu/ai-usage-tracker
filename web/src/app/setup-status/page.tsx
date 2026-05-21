"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { DevicesSection } from "@/components/devices-section";
import { useLocalMode } from "@/lib/use-local-mode";
import { useMessages } from "@/lib/use-i18n";

interface EnvInfo {
  platform: string | null;
  nodeVersion: string | null;
  nodeMajor: number | null;
  nodeManager: string | null;
  npmRoot: string | null;
  npmRootWritable: boolean | null;
  codeburnVersion: string | null;
  ccusageVersion: string | null;
  collectedAt: string | null;
}

interface StatusData {
  ready: boolean;
  lastSyncedAt: string | null;
  sessionsCount: number;
  envInfo: EnvInfo | null;
  steps: {
    cli_installed: boolean;
    hook_registered: boolean;
    first_session: boolean;
  };
}

export default function SetupStatusPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLocalMode = useLocalMode();
  const { m, locale } = useMessages();
  const [data, setData] = useState<StatusData | null>(null);
  const [copied, setCopied] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // 영어 모드면 영어 사용. 그 외엔 한국어 원본 유지 (FAQ 만 i18n 미적용 — 외부 데모 noncritical).
  const en = locale === "en";

  useEffect(() => {
    if (isLocalMode === null || isLocalMode) return;
    if (status === "unauthenticated") router.push("/login");
  }, [status, router, isLocalMode]);

  useEffect(() => {
    if (!session) return;
    setFetchError(false);
    fetch("/api/setup/status")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setData)
      .catch(() => setFetchError(true));
  }, [session, reloadKey]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const npxCmd = "npx github:eugene-eee-hongkyu/ai-usage-tracker init";

  if (fetchError) return (
    <div className="min-h-screen">
      <Nav />
      <div data-testid="status-fetch-error" className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-slate-300 text-sm">{en ? "Failed to load setup status." : "세팅 상태를 불러오지 못했어요."}</p>
        <p className="text-slate-500 text-xs">{en ? "Check your network/session and try again." : "네트워크·세션을 확인하고 다시 시도해주세요."}</p>
        <button
          data-testid="status-retry"
          onClick={() => setReloadKey((k) => k + 1)}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md transition-colors"
        >
          {m.common.retry}
        </button>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen">
      <Nav />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-500">{en ? "Loading…" : "로딩 중..."}</div>
      </div>
    </div>
  );

  const lastSync = data.lastSyncedAt ? new Date(data.lastSyncedAt) : null;
  const syncAge = lastSync ? Math.floor((Date.now() - lastSync.getTime()) / 60000) : null;
  const isStale = syncAge !== null && syncAge > 24 * 60;

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <h1 className="font-semibold text-slate-200">{en ? "Setup status" : "세팅 상태"}</h1>

        {/* Overall status */}
        <div data-testid="status-overall" className={`rounded-lg p-4 border ${data.ready ? "bg-green-950 border-green-800" : "bg-slate-900 border-slate-700"}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{data.ready ? "✅" : "⚙️"}</span>
            <div>
              <p className="font-semibold text-slate-100">
                {data.ready
                  ? (en ? "Operating normally" : "정상 작동 중")
                  : (en ? "Setup in progress" : "세팅 진행 중")}
              </p>
              <p className="text-sm text-slate-400 mt-0.5">
                {data.ready
                  ? (en
                      ? `${data.sessionsCount} sessions collected · last received: ${lastSync ? lastSync.toLocaleString("en-US") : "none"}`
                      : `세션 ${data.sessionsCount}개 수집됨 · 마지막 수집: ${lastSync ? lastSync.toLocaleString("ko") : "없음"}`)
                  : (en
                      ? "Complete the steps below and collection starts automatically"
                      : "아래 단계를 완료하면 자동으로 수집이 시작됩니다")}
              </p>
            </div>
          </div>
        </div>

        {/* Stale warning */}
        {isStale && (
          <div data-testid="status-stale-warning" className="bg-yellow-950 border border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-300 font-semibold text-sm">{en ? "⚠️ Collection may be stuck" : "⚠️ 수집이 멈췄을 수 있어요"}</p>
            <p className="text-yellow-400 text-sm mt-1">
              {en
                ? `Last received: ${syncAge! >= 60 ? `${Math.floor(syncAge! / 60)}h` : `${syncAge}m`} ago`
                : `마지막 수집: ${syncAge! >= 60 ? `${Math.floor(syncAge! / 60)}시간` : `${syncAge}분`} 전`}
            </p>
            <div className="mt-3 space-y-1 text-sm text-yellow-500">
              <p>{en ? "Things to check:" : "점검 항목:"}</p>
              <ul className="list-disc list-inside space-y-1 text-yellow-400">
                <li>{en ? "Claude Code SessionEnd hook is registered" : "Claude Code SessionEnd hook이 등록되어 있는지 확인"}</li>
                <li>{en ? "Network connectivity" : "네트워크 연결 상태 확인"}</li>
                <li>{en ? "Reinstall CLI" : "CLI 재설치"}: <code className="bg-yellow-900 px-1 rounded">npx github:eugene-eee-hongkyu/ai-usage-tracker init</code></li>
              </ul>
            </div>
          </div>
        )}

        {/* Step checklist */}
        <div className="bg-slate-900 rounded-lg p-4 space-y-3">
          <p className="text-sm text-slate-400 font-medium">{en ? "Install steps" : "설치 단계"}</p>

          <StepItem
            testid="status-step-cli"
            done={data.steps.cli_installed}
            title={en ? "Install CLI" : "CLI 설치"}
            desc={en ? "Installs usage-tracker via npx" : "npx 명령어로 usage-tracker를 설치합니다"}
          >
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-xs bg-slate-800 rounded px-3 py-2 text-indigo-300">{npxCmd}</code>
              <button
                data-testid="status-copy-cli"
                onClick={() => copy(npxCmd)}
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors whitespace-nowrap"
              >
                {copied ? (en ? "Copied" : "복사됨") : (en ? "Copy" : "복사")}
              </button>
            </div>
          </StepItem>

          <StepItem
            testid="status-step-hook"
            done={data.steps.hook_registered}
            title={en ? "Register SessionEnd hook" : "SessionEnd Hook 등록"}
            desc={en ? "CLI init registers the hook in Claude Code settings automatically" : "CLI init이 자동으로 Claude Code 설정에 훅을 등록합니다"}
          >
            {!data.steps.hook_registered && (
              <p className="text-xs text-slate-500 mt-2">
                {en ? "Claude Code settings: " : "Claude Code 설정 파일: "}<code className="text-slate-400">~/.claude/settings.json</code> →{" "}
                <code className="text-slate-400">hooks.SessionEnd</code>
              </p>
            )}
          </StepItem>

          <StepItem
            testid="status-step-first-session"
            done={data.steps.first_session}
            title={en ? "First session collected" : "첫 번째 세션 수집"}
            desc={en ? "Start a Claude Code session and end it — it's collected automatically" : "Claude Code 세션을 시작하고 종료하면 자동으로 수집됩니다"}
          >
            {!data.steps.first_session && (
              <p className="text-xs text-slate-500 mt-2">
                {en ? "Run " : "터미널에서 "}<code className="text-slate-400">claude</code>{en ? " and exit it" : "를 실행 후 종료하세요"}
              </p>
            )}
          </StepItem>
        </div>

        {/* 환경 진단 — CLI 가 ingest 시 보낸 envInfo 기반. 옛 cli 면 envInfo 없음. */}
        {data.envInfo && <EnvDiagnosticCard env={data.envInfo} en={en} />}

        {/* 내 디바이스 — api_tokens 기반 device-scope 관리 (M6e, 2026-05-21). */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <DevicesSection />
        </div>

        {/* Troubleshooting */}
        <div className="bg-slate-900 rounded-lg p-4 space-y-3">
          <p className="text-sm text-slate-400 font-medium">{en ? "Troubleshooting" : "문제 해결"}</p>
          <div className="space-y-2 text-sm">
            <details data-testid="status-faq-no-data" className="group">
              <summary className="cursor-pointer text-slate-300 hover:text-slate-100 list-none flex items-center gap-2">
                <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▶</span>
                {en ? "I don't see any data" : "데이터가 보이지 않아요"}
              </summary>
              <div className="mt-2 ml-4 space-y-1 text-slate-400 text-xs">
                {en ? (
                  <>
                    <p>1. Confirm the CLI is installed: <code className="text-slate-300">npx github:eugene-eee-hongkyu/ai-usage-tracker init</code></p>
                    <p>2. The Claude Code session must end fully to be collected (Ctrl+C or /quit)</p>
                    <p>3. Reinstall, then restart Claude Code</p>
                  </>
                ) : (
                  <>
                    <p>1. CLI가 설치되어 있는지 확인: <code className="text-slate-300">npx github:eugene-eee-hongkyu/ai-usage-tracker init</code></p>
                    <p>2. Claude Code 세션을 완전히 종료해야 수집됩니다 (Ctrl+C 또는 /quit)</p>
                    <p>3. 재설치 후 Claude Code를 재시작하세요</p>
                  </>
                )}
              </div>
            </details>

            <details data-testid="status-faq-reset-key" className="group">
              <summary className="cursor-pointer text-slate-300 hover:text-slate-100 list-none flex items-center gap-2">
                <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▶</span>
                {en ? "I want to reissue my API key" : "API 키를 재발급하고 싶어요"}
              </summary>
              <div className="mt-2 ml-4 space-y-1 text-slate-400 text-xs">
                <p>{en ? "Re-running the CLI issues and saves a fresh key:" : "CLI를 재실행하면 새 API 키가 자동으로 발급되고 저장됩니다:"}</p>
                <code className="text-slate-300">npx github:eugene-eee-hongkyu/ai-usage-tracker reset</code>
              </div>
            </details>

            <details data-testid="status-faq-backfill" className="group">
              <summary className="cursor-pointer text-slate-300 hover:text-slate-100 list-none flex items-center gap-2">
                <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▶</span>
                {en ? "I want to re-fetch historical data" : "과거 데이터를 다시 불러오고 싶어요"}
              </summary>
              <div className="mt-2 ml-4 space-y-1 text-slate-400 text-xs">
                {en ? (
                  <>
                    <p>init automatically collects the last 90 days in the background.</p>
                    <p>To re-run manually:</p>
                  </>
                ) : (
                  <>
                    <p>init 실행 시 자동으로 최근 90일치 데이터를 백그라운드에서 수집합니다.</p>
                    <p>수동으로 재실행하려면:</p>
                  </>
                )}
                <code className="text-slate-300">npx github:eugene-eee-hongkyu/ai-usage-tracker sync</code>
              </div>
            </details>

            <details data-testid="status-faq-win-hook" className="group">
              <summary className="cursor-pointer text-slate-300 hover:text-slate-100 list-none flex items-center gap-2">
                <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▶</span>
                {en ? "The hook isn't working on Windows" : "Windows에서 훅이 작동하지 않아요"}
              </summary>
              <div className="mt-2 ml-4 space-y-1 text-slate-400 text-xs">
                {en ? (
                  <>
                    <p>Verify Windows Claude Code&apos;s SessionEnd hook support manually.</p>
                    <p>Settings file location: <code className="text-slate-300">%APPDATA%\Claude\settings.json</code></p>
                    <p>Check hooks.SessionEnd is present; if not, run the CLI again.</p>
                  </>
                ) : (
                  <>
                    <p>Windows Claude Code의 SessionEnd hook 지원을 수동으로 확인해야 합니다.</p>
                    <p>Claude Code 설정 파일 위치: <code className="text-slate-300">%APPDATA%\Claude\settings.json</code></p>
                    <p>hooks.SessionEnd 항목이 있는지 확인하고, 없으면 CLI를 다시 실행하세요.</p>
                  </>
                )}
              </div>
            </details>
          </div>
        </div>

      </main>
    </div>
  );
}

// 사용자 Node/npm 환경 진단 카드. CLI submit.mjs 가 ingest body 에 envInfo 로 보낸 것.
// 위험 신호(시스템 .pkg Node, npm root 쓰기 불가, codeburn/ccusage 미설치) 가 있으면
// 본인이 안내받기 전 자가 진단 가능.
function EnvDiagnosticCard({ env, en }: { env: EnvInfo; en: boolean }) {
  const issues: string[] = [];
  if (env.npmRootWritable === false) {
    issues.push(en
      ? "npm global dir not writable — codeburn/ccusage updates blocked"
      : "npm 전역 디렉토리 쓰기 불가 — codeburn/ccusage 업데이트가 막힙니다");
  }
  if (env.nodeMajor !== null && env.nodeMajor < 22) {
    issues.push(en
      ? `Node ${env.nodeMajor} — codeburn 0.9.8+ recommends Node 22+`
      : `Node ${env.nodeMajor} — codeburn 0.9.8+ 는 Node 22 이상 권장`);
  }
  if (env.nodeManager === "pkg_installer") {
    issues.push(en
      ? "System .pkg Node in use — switch to nvm (repeat sudo risk)"
      : "시스템 .pkg Node 사용 중 — nvm 전환 권장 (반복적 sudo 사고 위험)");
  }
  if (!env.codeburnVersion) {
    issues.push(en
      ? "codeburn not installed — one-shot rate / cost data not collected"
      : "codeburn 미설치 — one-shot rate / cost 데이터 수집 안 됨");
  }
  if (!env.ccusageVersion) {
    issues.push(en
      ? "ccusage not installed — token / cost data not collected"
      : "ccusage 미설치 — 토큰/비용 데이터 수집 안 됨");
  }
  const hasIssues = issues.length > 0;
  const notInstalled = en ? "not installed" : "미설치";

  return (
    <div
      data-testid="status-env-card"
      className={`rounded-lg p-4 space-y-3 ${hasIssues ? "bg-amber-950/40 border border-amber-800/60" : "bg-slate-900 border border-slate-800"}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-300 font-medium">
          {hasIssues ? "⚠️" : "✓"} {en ? "My environment" : "내 환경 진단"}
        </p>
        {env.collectedAt && (
          <p className="text-[10px] text-slate-500 font-mono">
            {new Date(env.collectedAt).toLocaleString(en ? "en-US" : "ko")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono">
        <span className="text-slate-500">Node</span>
        <span className={env.nodeMajor !== null && env.nodeMajor < 22 ? "text-amber-300" : "text-slate-300"}>
          {env.nodeVersion ?? "—"}{env.nodeManager ? ` · ${env.nodeManager}` : ""}
        </span>

        <span className="text-slate-500">{en ? "npm global writable" : "npm 전역 쓰기"}</span>
        <span className={env.npmRootWritable === false ? "text-red-400" : "text-slate-300"}>
          {env.npmRootWritable === true ? "✓" : env.npmRootWritable === false ? "❌" : "—"}
        </span>

        <span className="text-slate-500">codeburn</span>
        <span className={env.codeburnVersion ? "text-slate-300" : "text-red-400"}>
          {env.codeburnVersion ?? notInstalled}
        </span>

        <span className="text-slate-500">ccusage</span>
        <span className={env.ccusageVersion ? "text-slate-300" : "text-red-400"}>
          {env.ccusageVersion ?? notInstalled}
        </span>

        <span className="text-slate-500">platform</span>
        <span className="text-slate-300">{env.platform ?? "—"}</span>
      </div>

      {hasIssues && (
        <div data-testid="status-env-issues" className="pt-2 border-t border-amber-800/40 space-y-1.5">
          <p className="text-xs text-amber-300 font-medium">{en ? "Issues" : "발견된 문제"} ({issues.length})</p>
          <ul className="space-y-1 text-xs text-amber-200 list-disc list-inside">
            {issues.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
          <div className="pt-2 text-xs text-amber-300/80 leading-relaxed">
            {en ? "Repair: " : "복구: "}
            <code className="bg-slate-900/60 px-1.5 py-0.5 rounded text-amber-200">
              npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair
            </code>
            <p className="text-[11px] text-slate-400 mt-1">
              {en
                ? "If repair detects permission issues, it shows an auto-recovery prompt."
                : "repair 가 권한 문제를 감지하면 자동 복구 prompt 를 띄웁니다."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StepItem({
  testid,
  done,
  title,
  desc,
  children,
}: {
  testid?: string;
  done: boolean;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div data-testid={testid} className={`rounded p-3 border ${done ? "border-green-800 bg-green-950/30" : "border-slate-700"}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{done ? "✅" : "⬜"}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-200">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
