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

  // Poll for init completion
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/setup/status");
        const data = await res.json();
        if (data.steps) setSteps(data.steps);
        if (data.ready) {
          clearInterval(interval);
          router.push("/dashboard");
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [session, router]);

  const initCmd = `npx github:${process.env.NEXT_PUBLIC_GITHUB_ORG ?? "eugene-eee-hongkyu"}/ai-usage-tracker init`;

  const copy = () => {
    navigator.clipboard.writeText(initCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === "loading") return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">안녕 {session?.user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-slate-400 mt-2">터미널에서 아래 명령어 한 줄 실행하세요</p>
      </div>

      <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 w-full max-w-md">
        <code className="flex-1 text-sm text-slate-200 font-mono">{initCmd}</code>
        <button
          onClick={copy}
          className="text-slate-400 hover:text-slate-200 transition-colors shrink-0"
          title="복사"
        >
          {copied ? (
            <span className="text-green-400 text-xs">복사됨</span>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      <div className="w-full max-w-md space-y-2">
        <p className="text-sm text-slate-400">⚙️ 진행 상태</p>
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            {step.done ? (
              <span className="text-green-400">✅</span>
            ) : (
              <span className="text-slate-500 animate-pulse">⏳</span>
            )}
            <span className={step.done ? "text-slate-300" : "text-slate-500"}>{step.label}</span>
          </div>
        ))}
        <p className="text-xs text-slate-500 mt-4">
          완료되면 자동으로 다음 단계로 이동합니다
        </p>
        <p className="text-xs text-slate-500">
          ※ 과거 데이터는 백그라운드에서 모이므로 먼저 대시보드를 둘러보세요
        </p>
      </div>

      <a href="/setup-status" className="text-xs text-slate-500 hover:text-slate-300 underline">
        💡 잘 안 되면? 트러블슈팅 →
      </a>
    </div>
  );
}
