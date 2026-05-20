"use client";

// /onboard-team — 어드민이 본인 팀의 회사명을 처음 정하는 화면.
// 진입 경로: signIn 직후 OnboardTeamGuard 가 namePending=true 면 redirect.
// 본인이 회사명 한 줄 입력 → PATCH /api/team/onboard → hard reload 로 /admin/members.
//
// hard reload 이유: useSession 캐시가 stale 이라 OnboardTeamGuard 가 다시 튕길 수 있음.

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMessages } from "@/lib/use-i18n";

export default function OnboardTeamPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { m } = useMessages();
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
            ? m.onboardTeam.errorSlugTaken(data.slug ?? "")
            : data.error === "already_named"
              ? m.onboardTeam.errorAlreadyNamed
              : data.error === "invalid_team_name"
                ? m.onboardTeam.errorInvalidName
                : data.error ?? `HTTP ${resp.status}`;
        setErrorMsg(msg);
        setPhase("error");
        return;
      }
      // hard reload — session 캐시 invalidate.
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
          <h1 className="text-2xl font-bold">
            {m.onboardTeam.greeting}
            {userName ? m.onboardTeam.nameSuffix(userName) : ""}
          </h1>
          <p className="text-sm text-neutral-400">{m.onboardTeam.sub}</p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs text-neutral-400 uppercase tracking-wide">
            {m.onboardTeam.fieldLabel}
          </span>
          <input
            type="text"
            required
            maxLength={80}
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder={m.onboardTeam.placeholder}
            autoFocus
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
          <span className="text-[11px] text-neutral-500">{m.onboardTeam.helper}</span>
        </label>
        {phase === "error" && <p className="text-sm text-red-400 font-mono">{errorMsg}</p>}
        <button
          type="submit"
          disabled={phase === "submitting" || teamName.trim().length === 0}
          className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded font-semibold"
        >
          {phase === "submitting" ? m.onboardTeam.submitting : m.onboardTeam.submit}
        </button>
      </form>
    </main>
  );
}
