"use client";

// /join — 가입 신청 페이지 (public, no auth).
// invitation 없는 신규 OAuth 사용자가 signIn callback 에 의해 redirect 되는 곳.
// email/name 은 query string 으로 prefill. 사용자가 메시지 입력 후 제출 → /api/join-request
// 가 anonymous POST 받음 (email 은 form 에서). admin 이 승인하면 invitation 이메일 발송.

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinInner />
    </Suspense>
  );
}

function JoinInner() {
  const params = useSearchParams();
  const initialEmail = params.get("email") ?? "";
  const initialName = params.get("name") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [teamNameHint, setTeamNameHint] = useState("");
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<"form" | "submitting" | "done" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("submitting");
    try {
      // anonymous POST — server-side public route.
      const resp = await fetch("/api/join-request/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, teamNameHint, message }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      setPhase("done");
    } catch (e) {
      setErrorMsg((e as Error).message);
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-emerald-400">✓ 가입 신청 접수됨</h1>
          <p className="text-neutral-400">
            팀 관리자가 검토 후 승인 메일을 보내드립니다. 보통 1~2 영업일.
          </p>
          <p className="text-xs text-neutral-500">
            승인되면 install.sh 실행 안내 메일을 받으실 수 있습니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6 py-12">
      <form onSubmit={submit} className="max-w-md w-full space-y-5">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">가입 안내</h1>
          <p className="text-sm text-neutral-400">
            이 이메일 도메인은 아직 등록된 회사가 없습니다. 둘 중 해당하는 경우로 진행해주세요.
          </p>
          <div className="bg-neutral-900 border border-neutral-800 rounded p-3 space-y-2 text-xs">
            <p className="text-neutral-300">
              <span className="text-indigo-300 font-semibold">① 기존 회사 멤버라면</span> — 회사 관리자에게 초대 요청하세요.
              관리자가 admin/users 에서 사용자 초대를 발송하면 메일 링크로 가입할 수 있습니다.
            </p>
            <p className="text-neutral-300">
              <span className="text-emerald-300 font-semibold">② 신규 회사 등록</span> — 아래 폼에 정보를 남겨주세요.
              AI Usage Tracker 운영팀이 검토 후 회사를 등록하고 owner 초대 메일을 보내드립니다.
            </p>
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs text-neutral-400 uppercase tracking-wide">이메일</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-neutral-400 uppercase tracking-wide">이름</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-neutral-400 uppercase tracking-wide">소속 팀 / 회사 (선택)</span>
          <input
            type="text"
            value={teamNameHint}
            onChange={(e) => setTeamNameHint(e.target.value)}
            placeholder="z21labs"
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-neutral-400 uppercase tracking-wide">메시지 (선택)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="가입 사유 — 관리자가 검토에 참고합니다"
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
          />
        </label>
        {phase === "error" && (
          <p className="text-sm text-red-400 font-mono">{errorMsg}</p>
        )}
        <button
          type="submit"
          disabled={phase === "submitting"}
          className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded font-semibold"
        >
          {phase === "submitting" ? "전송 중..." : "가입 신청"}
        </button>
      </form>
    </main>
  );
}
