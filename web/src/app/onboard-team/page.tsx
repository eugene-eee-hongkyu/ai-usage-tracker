"use client";

// /onboard-team — 어드민이 본인 팀의 회사명을 처음 정하는 화면.
// 진입 경로: signIn 직후 dashboard/admin layout 가드가 namePending=true 면 redirect.
// 본인이 회사명 한 줄 입력 → PATCH /api/team/onboard → 성공하면 /admin/members 로 이동.
//
// 권한: 세션만 있으면 OK. 가드에서 이미 namePending true 인 사람만 보내므로 별도
//   server check 불필요 (PATCH API 가 namePending 재검증).

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function OnboardTeamPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [teamName, setTeamName] = useState("");
  const [phase, setPhase] = useState<"form" | "submitting" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (teamName.trim().length === 0) return;
    setPhase("submitting");
    setErrorMsg("");
    try {
      const resp = await fetch("/api/team/onboard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        slug?: string;
      };
      if (!resp.ok || !data.ok) {
        const msg =
          data.error === "slug_taken"
            ? `이미 사용 중인 이름입니다 (${data.slug}). 다른 이름을 입력해주세요.`
            : data.error === "already_named"
              ? "이미 설정된 팀입니다."
              : data.error ?? `HTTP ${resp.status}`;
        setErrorMsg(msg);
        setPhase("error");
        return;
      }
      // 회사명 설정 완료 — admin/members 로 이동. session.user.currentTeamNamePending
      // 은 클라이언트 캐시라 stale. OnboardTeamGuard 가 다시 /onboard-team 으로 튕기는
      // 사고 방지 위해 hard reload (window.location) 로 session 재페치 보장.
      window.location.href = "/admin/members";
      return;
    } catch (e) {
      setErrorMsg((e as Error).message);
      setPhase("error");
    }
  }

  if (status === "loading") {
    return <main className="min-h-screen bg-neutral-950" />;
  }
  if (status === "unauthenticated") {
    if (typeof window !== "undefined") router.push("/login");
    return null;
  }

  const userName = session?.user?.name ?? "";

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6 py-12">
      <form onSubmit={submit} className="max-w-md w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">환영합니다{userName ? `, ${userName}님` : ""}</h1>
          <p className="text-sm text-neutral-400">
            당신은 이 회사의 어드민입니다. 먼저 회사명을 정해주세요.
          </p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs text-neutral-400 uppercase tracking-wide">회사명</span>
          <input
            type="text"
            required
            maxLength={80}
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="예: thenexa"
            autoFocus
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
          <span className="text-[11px] text-neutral-500">
            팀 멤버 초대·랭킹 등에서 표시됩니다. 나중에 어드민 설정에서 변경할 수 있어요.
          </span>
        </label>
        {phase === "error" && (
          <p className="text-sm text-red-400 font-mono">{errorMsg}</p>
        )}
        <button
          type="submit"
          disabled={phase === "submitting" || teamName.trim().length === 0}
          className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded font-semibold"
        >
          {phase === "submitting" ? "저장 중..." : "회사명 저장하고 시작하기"}
        </button>
      </form>
    </main>
  );
}
