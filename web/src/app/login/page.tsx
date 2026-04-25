"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-100">Primus Usage Tracker</h1>
        <p className="text-slate-400">AI 코딩 도구를 얼마나, 어떻게 쓰고 있는지 한눈에</p>
        <p className="text-xs text-slate-500">Primus Labs 멤버 전용</p>
      </div>

      {error === "domain" && (
        <p className="text-red-400 text-sm bg-red-950 px-4 py-2 rounded">
          Primus Labs 이메일(@primuslabs.gg)이 아니네요.
        </p>
      )}
      {error && error !== "domain" && (
        <p className="text-red-400 text-sm bg-red-950 px-4 py-2 rounded">
          로그인 중 오류가 발생했습니다.
        </p>
      )}

      <button
        onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
        className="flex items-center gap-3 px-6 py-3 bg-slate-100 text-slate-900 rounded-lg font-semibold hover:bg-white transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        GitHub로 시작하기
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
