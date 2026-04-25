"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = { label: string; done: boolean };

export default function SetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([
    { label: "Node 18+ 확인", done: false },
    { label: "keytar 설치", done: false },
    { label: "hook 등록", done: false },
  ]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/setup/status");
        const data = await res.json();
        if (data.steps) setSteps(data.steps);
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
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-100">
          안녕 {session?.user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-slate-400 mt-2">딱 한 번만 설치하면 자동 수집 시작됩니다</p>
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
          브라우저가 열리면 GitHub 로그인 → 완료
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
