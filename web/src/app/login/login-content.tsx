"use client";

// 클라이언트 로그인 UI. 옛 login/page.tsx 의 LoginContent + LoginPage 그대로.
// 서버 세션 검사 (이미 로그인 시 /dashboard 직행) 는 login/page.tsx 에서 처리.

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useLocalMode } from "@/lib/use-local-mode";
import { useMessages } from "@/lib/use-i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { track, EVENTS } from "@/lib/analytics/mixpanel";

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const error = params.get("error");
  const isLocalMode = useLocalMode();
  const { m } = useMessages();

  // 로컬 모드면 로그인 X — 자동으로 dashboard 로 보냄. 어쩌다 /login URL 로
  // 진입해도 (예전 캐시/링크) 자동 우회. defense in depth.
  useEffect(() => {
    if (isLocalMode) router.replace("/dashboard");
  }, [isLocalMode, router]);

  // login_view — LOCAL_MODE 아닌 사용자가 실제로 로그인 화면 본 시점.
  // error 가 있으면 props 로 첨부 (provider_mismatch 등의 빈도 추적).
  useEffect(() => {
    if (isLocalMode === false) {
      track(EVENTS.LOGIN_VIEW, { error: error ?? null });
    }
  }, [isLocalMode, error]);

  // 로컬 모드 확인 중이거나 확정된 경우 login UI 렌더 안 함 (깜빡임 방지)
  if (isLocalMode === null || isLocalMode) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 relative">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher variant="nav" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-100">AI Usage Tracker</h1>
        <p className="text-slate-400">{m.login.tagline}</p>
        <p className="text-xs text-slate-500">{m.login.teamOnly}</p>
        <p className="text-[11px] text-slate-600 max-w-xs mx-auto pt-2">
          {m.login.singleOauthHint}
        </p>
      </div>

      {error === "domain" && (
        <p data-testid="login-error-domain" className="text-red-400 text-sm bg-red-950 px-4 py-2 rounded">
          {m.login.errorDomain}
        </p>
      )}
      {error === "provider_mismatch" && (
        <p data-testid="login-error-provider-mismatch" className="text-red-400 text-sm bg-red-950 px-4 py-2 rounded max-w-md text-center">
          {m.login.errorProviderMismatch}
        </p>
      )}
      {error && error !== "domain" && error !== "provider_mismatch" && (
        <p data-testid="login-error-other" className="text-red-400 text-sm bg-red-950 px-4 py-2 rounded">
          {m.login.errorOther}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-slate-600">
        <a href="https://ai.z21labs.world" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 underline underline-offset-2">
          ai.z21labs.world
        </a>
        <span className="text-slate-800">·</span>
        <a href="https://github.com/eugene-eee-hongkyu/ai-usage-tracker" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 underline underline-offset-2 flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          GitHub
        </a>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          data-testid="login-btn-github"
          onClick={() => {
            track(EVENTS.OAUTH_START, { provider: "github" });
            signIn("github", { callbackUrl: "/dashboard" });
          }}
          className="flex items-center justify-center gap-3 px-6 py-3 bg-slate-100 text-slate-900 rounded-lg font-semibold hover:bg-white transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          {m.login.githubStart}
        </button>

        <button
          data-testid="login-btn-google"
          onClick={() => {
            track(EVENTS.OAUTH_START, { provider: "google" });
            signIn("google", { callbackUrl: "/dashboard" });
          }}
          className="flex items-center justify-center gap-3 px-6 py-3 bg-white text-slate-800 rounded-lg font-semibold hover:bg-slate-50 transition-colors border border-slate-200"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {m.login.googleStart}
        </button>
      </div>
    </div>
  );
}

export function LoginContent() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
