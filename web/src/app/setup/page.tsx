"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TIMEZONE_LIST: { label: string; value: string }[] = [
  { label: "SGT — Singapore (UTC+8)", value: "Asia/Singapore" },
  { label: "KST — Korea (UTC+9)", value: "Asia/Seoul" },
  { label: "JST — Japan (UTC+9)", value: "Asia/Tokyo" },
  { label: "HKT — Hong Kong (UTC+8)", value: "Asia/Hong_Kong" },
  { label: "CST — China (UTC+8)", value: "Asia/Shanghai" },
  { label: "IST — India (UTC+5:30)", value: "Asia/Kolkata" },
  { label: "GMT/BST — UK", value: "Europe/London" },
  { label: "CET — Central Europe", value: "Europe/Paris" },
  { label: "EST/EDT — US Eastern", value: "America/New_York" },
  { label: "CST/CDT — US Central", value: "America/Chicago" },
  { label: "PST/PDT — US Pacific", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
];

type Step = { label: string; done: boolean };

function NodeInstallGuide() {
  const [os, setOs] = useState<"mac" | "windows" | "other">("other");
  const [hasNode, setHasNode] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) setOs("mac");
    else if (ua.includes("win")) setOs("windows");
  }, []);

  if (hasNode) return null;

  return (
    <div className="w-full max-w-md bg-amber-950 border border-amber-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-amber-400 font-semibold tracking-wide uppercase">사전 준비</p>
          <p className="text-slate-100 font-medium mt-1">Node.js가 필요해요</p>
          <p className="text-sm text-slate-400 mt-1">
            명령어를 실행하려면 Node.js가 설치되어 있어야 합니다.
          </p>
        </div>
      </div>

      {os === "mac" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-amber-400 font-bold">1.</span>
            <span>아래 버튼을 눌러 설치 파일을 다운로드하세요 <span className="text-slate-500">(.pkg)</span></span>
          </div>
          <a
            href="https://nodejs.org/ko/download"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Node.js 다운로드 (LTS) →
          </a>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-amber-400 font-bold">2.</span>
            <span>다운받은 <strong>.pkg</strong> 파일을 더블클릭해서 설치하세요</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-amber-400 font-bold">3.</span>
            <span>설치 완료 후 아래 버튼을 눌러 계속하세요</span>
          </div>
        </div>
      )}

      {os === "windows" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-amber-400 font-bold">1.</span>
            <span>아래 버튼을 눌러 설치 파일을 다운로드하세요 <span className="text-slate-500">(.msi)</span></span>
          </div>
          <a
            href="https://nodejs.org/ko/download"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Node.js 다운로드 (LTS) →
          </a>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-amber-400 font-bold">2.</span>
            <span>다운받은 <strong>.msi</strong> 파일을 더블클릭해서 설치하세요</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-amber-400 font-bold">3.</span>
            <span>설치 완료 후 아래 버튼을 눌러 계속하세요</span>
          </div>
        </div>
      )}

      {os === "other" && (
        <div className="space-y-2">
          <a
            href="https://nodejs.org/ko/download"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Node.js 다운로드 (LTS) →
          </a>
          <p className="text-xs text-slate-400">설치 파일을 다운로드해서 실행하세요</p>
        </div>
      )}

      <button
        onClick={() => setHasNode(true)}
        className="w-full text-center px-4 py-2 border border-slate-600 hover:border-slate-400 text-slate-400 hover:text-slate-200 text-sm rounded-lg transition-colors"
      >
        ✓ Node.js 이미 설치됨 — 다음 단계로
      </button>
    </div>
  );
}

export default function SetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([
    { label: "hook 등록", done: false },
    { label: "첫 데이터 수신", done: false },
  ]);
  const [copied, setCopied] = useState(false);
  const [timezone, setTimezone] = useState<string>("");
  const [tzSaved, setTzSaved] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(detected);
  }, []);

  const saveTz = async (tz: string) => {
    setTimezone(tz);
    setTzSaved(false);
    await fetch("/api/user/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    });
    setTzSaved(true);
  };

  useEffect(() => {
    if (!session) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/setup/status");
        const data = await res.json();
        if (data.steps) setSteps([
          { label: "hook 등록", done: !!data.steps.hook_registered },
          { label: "첫 데이터 수신", done: !!data.steps.first_session },
        ]);
      } catch {
        // ignore
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [session]);

  const initCmd = `npx github:${process.env.NEXT_PUBLIC_GITHUB_ORG ?? "eugene-eee-hongkyu"}/ai-usage-tracker init`;

  const copy = () => {
    navigator.clipboard.writeText(initCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === "loading") return null;

  const allDone = steps.every((s) => s.done);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-100">
          안녕 {session?.user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-slate-400 mt-2">딱 한 번만 설치하면 자동 수집 시작됩니다</p>
      </div>

      {/* 사전 준비 — Node.js */}
      <NodeInstallGuide />

      {/* 타임존 설정 */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
        <div>
          <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">타임존 설정</p>
          <p className="text-sm text-slate-400 mt-1">
            대시보드 시간 표시에 사용됩니다. 자동으로 감지했습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timezone}
            onChange={(e) => saveTz(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-600 text-slate-100 text-sm rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-indigo-500"
          >
            {timezone && !TIMEZONE_LIST.find((t) => t.value === timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
            {TIMEZONE_LIST.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {tzSaved && (
            <span className="text-green-400 text-xs font-mono shrink-0">✓ 저장됨</span>
          )}
        </div>
      </div>

      {/* Step 1 — 핵심 액션 */}
      <div className="w-full max-w-md bg-indigo-950 border border-indigo-700 rounded-xl p-5 space-y-3">
        <p className="text-xs text-indigo-400 font-semibold tracking-wide uppercase">Step 1</p>
        <p className="text-slate-100 font-medium">터미널을 열고 아래 명령어를 실행하세요</p>
        <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-4 py-3">
          <code className="flex-1 text-sm text-indigo-300 font-mono break-all">{initCmd}</code>
          <button
            onClick={copy}
            className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-md transition-colors font-medium"
          >
            {copied ? "✓ 복사됨" : "복사"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          브라우저가 열리면 로그인 → 완료
        </p>
      </div>

      {/* Step 2 — 진행 상태 */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Step 2 — 자동 완료 대기 중</p>
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className={step.done ? "text-green-400" : "text-slate-600 animate-pulse"}>
              {step.done ? "✅" : "⏳"}
            </span>
            <span className={step.done ? "text-slate-200" : "text-slate-500"}>{step.label}</span>
          </div>
        ))}
        {!allDone && (
          <p className="text-xs text-slate-600 pt-1">
            명령어 실행 후 여기가 자동으로 체크됩니다
          </p>
        )}
        {allDone && (
          <div className="pt-2">
            <p className="text-xs text-green-400 mb-3">✓ 설치 완료</p>
            <a
              href="/dashboard"
              className="block w-full text-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              대시보드로 가기 →
            </a>
          </div>
        )}
      </div>

      <a href="/setup-status" className="text-xs text-slate-600 hover:text-slate-400 underline">
        잘 안 되면? 트러블슈팅 →
      </a>
    </div>
  );
}
