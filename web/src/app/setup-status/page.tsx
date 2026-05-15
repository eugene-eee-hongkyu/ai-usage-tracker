"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";
import { isAdmin } from "@/lib/admin";

interface StatusData {
  ready: boolean;
  lastSyncedAt: string | null;
  sessionsCount: number;
  steps: {
    cli_installed: boolean;
    hook_registered: boolean;
    first_session: boolean;
  };
}

export default function SetupStatusPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<StatusData | null>(null);
  const [copied, setCopied] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

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
        <p className="text-slate-300 text-sm">셋업 상태를 불러오지 못했어요.</p>
        <p className="text-slate-500 text-xs">네트워크·세션을 확인하고 다시 시도해주세요.</p>
        <button
          data-testid="status-retry"
          onClick={() => setReloadKey((k) => k + 1)}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen">
      <Nav />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-500">로딩 중...</div>
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
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-200 text-sm">← 메인</Link>
          <h1 className="font-semibold text-slate-200">셋업 상태</h1>
        </div>

        {/* Overall status */}
        <div data-testid="status-overall" className={`rounded-lg p-4 border ${data.ready ? "bg-green-950 border-green-800" : "bg-slate-900 border-slate-700"}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{data.ready ? "✅" : "⚙️"}</span>
            <div>
              <p className="font-semibold text-slate-100">
                {data.ready ? "정상 작동 중" : "셋업 진행 중"}
              </p>
              <p className="text-sm text-slate-400 mt-0.5">
                {data.ready
                  ? `세션 ${data.sessionsCount}개 수집됨 · 마지막 수집: ${lastSync ? lastSync.toLocaleString("ko") : "없음"}`
                  : "아래 단계를 완료하면 자동으로 수집이 시작됩니다"}
              </p>
            </div>
          </div>
        </div>

        {/* Stale warning */}
        {isStale && (
          <div data-testid="status-stale-warning" className="bg-yellow-950 border border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-300 font-semibold text-sm">⚠️ 수집이 멈췄을 수 있어요</p>
            <p className="text-yellow-400 text-sm mt-1">
              마지막 수집: {syncAge! >= 60 ? `${Math.floor(syncAge! / 60)}시간` : `${syncAge}분`} 전
            </p>
            <div className="mt-3 space-y-1 text-sm text-yellow-500">
              <p>점검 항목:</p>
              <ul className="list-disc list-inside space-y-1 text-yellow-400">
                <li>Claude Code SessionEnd hook이 등록되어 있는지 확인</li>
                <li>네트워크 연결 상태 확인</li>
                <li>CLI 재설치: <code className="bg-yellow-900 px-1 rounded">npx github:eugene-eee-hongkyu/ai-usage-tracker init</code></li>
              </ul>
            </div>
          </div>
        )}

        {/* Step checklist */}
        <div className="bg-slate-900 rounded-lg p-4 space-y-3">
          <p className="text-sm text-slate-400 font-medium">설치 단계</p>

          <StepItem
            testid="status-step-cli"
            done={data.steps.cli_installed}
            title="CLI 설치"
            desc="npx 명령어로 usage-tracker를 설치합니다"
          >
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-xs bg-slate-800 rounded px-3 py-2 text-indigo-300">{npxCmd}</code>
              <button
                data-testid="status-copy-cli"
                onClick={() => copy(npxCmd)}
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors whitespace-nowrap"
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          </StepItem>

          <StepItem
            testid="status-step-hook"
            done={data.steps.hook_registered}
            title="SessionEnd Hook 등록"
            desc="CLI init이 자동으로 Claude Code 설정에 훅을 등록합니다"
          >
            {!data.steps.hook_registered && (
              <p className="text-xs text-slate-500 mt-2">
                Claude Code 설정 파일: <code className="text-slate-400">~/.claude/settings.json</code> →{" "}
                <code className="text-slate-400">hooks.SessionEnd</code>
              </p>
            )}
          </StepItem>

          <StepItem
            testid="status-step-first-session"
            done={data.steps.first_session}
            title="첫 번째 세션 수집"
            desc="Claude Code 세션을 시작하고 종료하면 자동으로 수집됩니다"
          >
            {!data.steps.first_session && (
              <p className="text-xs text-slate-500 mt-2">
                터미널에서 <code className="text-slate-400">claude</code>를 실행 후 종료하세요
              </p>
            )}
          </StepItem>
        </div>

        {/* Troubleshooting */}
        <div className="bg-slate-900 rounded-lg p-4 space-y-3">
          <p className="text-sm text-slate-400 font-medium">문제 해결</p>
          <div className="space-y-2 text-sm">
            <details data-testid="status-faq-no-data" className="group">
              <summary className="cursor-pointer text-slate-300 hover:text-slate-100 list-none flex items-center gap-2">
                <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▶</span>
                데이터가 보이지 않아요
              </summary>
              <div className="mt-2 ml-4 space-y-1 text-slate-400 text-xs">
                <p>1. CLI가 설치되어 있는지 확인: <code className="text-slate-300">npx github:eugene-eee-hongkyu/ai-usage-tracker init</code></p>
                <p>2. Claude Code 세션을 완전히 종료해야 수집됩니다 (Ctrl+C 또는 /quit)</p>
                <p>3. 재설치 후 Claude Code를 재시작하세요</p>
              </div>
            </details>

            <details data-testid="status-faq-reset-key" className="group">
              <summary className="cursor-pointer text-slate-300 hover:text-slate-100 list-none flex items-center gap-2">
                <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▶</span>
                API 키를 재발급하고 싶어요
              </summary>
              <div className="mt-2 ml-4 space-y-1 text-slate-400 text-xs">
                <p>CLI를 재실행하면 새 API 키가 자동으로 발급되고 저장됩니다:</p>
                <code className="text-slate-300">npx github:eugene-eee-hongkyu/ai-usage-tracker reset</code>
              </div>
            </details>

            <details data-testid="status-faq-backfill" className="group">
              <summary className="cursor-pointer text-slate-300 hover:text-slate-100 list-none flex items-center gap-2">
                <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▶</span>
                과거 데이터를 다시 불러오고 싶어요
              </summary>
              <div className="mt-2 ml-4 space-y-1 text-slate-400 text-xs">
                <p>init 실행 시 자동으로 최근 90일치 데이터를 백그라운드에서 수집합니다.</p>
                <p>수동으로 재실행하려면:</p>
                <code className="text-slate-300">npx github:eugene-eee-hongkyu/ai-usage-tracker sync</code>
              </div>
            </details>

            <details data-testid="status-faq-win-hook" className="group">
              <summary className="cursor-pointer text-slate-300 hover:text-slate-100 list-none flex items-center gap-2">
                <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▶</span>
                Windows에서 훅이 작동하지 않아요
              </summary>
              <div className="mt-2 ml-4 space-y-1 text-slate-400 text-xs">
                <p>Windows Claude Code의 SessionEnd hook 지원을 수동으로 확인해야 합니다.</p>
                <p>Claude Code 설정 파일 위치: <code className="text-slate-300">%APPDATA%\Claude\settings.json</code></p>
                <p>hooks.SessionEnd 항목이 있는지 확인하고, 없으면 CLI를 다시 실행하세요.</p>
              </div>
            </details>
          </div>
        </div>

        {data.ready && (
          <div className="text-center">
            <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm">
              대시보드로 돌아가기 →
            </Link>
          </div>
        )}

        {isAdmin(session?.user?.email ?? "") && (
          <div className="pt-4 border-t border-slate-800 flex justify-center">
            <Link
              href="/admin/team"
              data-testid="setup-go-admin"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-mono text-amber-300 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors"
            >
              어드민으로 이동 →
            </Link>
          </div>
        )}
      </main>
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
