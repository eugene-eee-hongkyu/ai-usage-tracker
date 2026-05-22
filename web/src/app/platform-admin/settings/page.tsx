// /platform-admin/settings — Platform Admin (ADMIN_EMAIL env 화이트리스트) 전용.
// 이전 경로: /admin/platform. 2026-05-22 어드민 / 플랫폼 어드민 화면 분리 결정으로
// /platform-admin/* 하위로 이동. 기능 동일 — 모든 팀 현황 + view-as switcher + 새
// 팀 생성/초대.
//
// 권한 위계:
//   Platform Admin (session.user.isPlatformAdmin)  ← 이 페이지 접근 가능
//   Team Owner (team_members.role='owner')
//   Team Admin (membershipAdmin / billingAdmin)
//   Member
//
// "팀 권한 변경" / "비활성 사용자" / "데이터 보관 기간" 같은 자기 팀 단위 설정은
// /admin/settings 에 남는다 (어드민 영역).

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface TeamRow {
  id: number;
  name: string;
  slug: string;
  ownerId: number;
  namePending?: boolean;
  createdAt: string;
  deletedAt: string | null;
  memberCount?: number;
  members?: Array<{ userId: number; email: string; name: string; role: string }>;
}

export default function PlatformAdminSettingsPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-lg font-bold text-slate-100">Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          모든 팀 현황 · view-as 진입 · 새 팀 생성 + 첫 owner 초대.
        </p>
      </header>
      <TeamsOverviewSection />
      <CreateTeamSection />
    </div>
  );
}

function TeamsOverviewSection() {
  const [data, setData] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const { data: session } = useSession();
  const u = session?.user as
    | { currentTeamId?: number | null; viewAsTeamId?: number | null }
    | undefined;
  const currentTeamId = u?.currentTeamId ?? null;
  const viewAsTeamId = u?.viewAsTeamId ?? null;

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/teams?include=members");
      if (!r.ok) return;
      const d = (await r.json()) as { teams: TeamRow[] };
      setData(d.teams);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTeams();
  }, [fetchTeams]);

  async function switchTo(teamId: number) {
    if (switchingId !== null) return;
    setSwitchingId(teamId);
    try {
      const r = await fetch("/api/admin/platform/switch-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (r.ok) {
        window.location.reload();
      } else {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        alert(`Switch 실패: ${err.error ?? "unknown"}`);
        setSwitchingId(null);
      }
    } catch (e) {
      alert(`Switch 실패: ${String(e)}`);
      setSwitchingId(null);
    }
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
      <header>
        <h2 className="text-sm font-bold text-slate-200">팀 현황</h2>
        <p className="text-xs text-slate-500 mt-1">
          현재 존재하는 모든 팀 + 각 팀의 멤버. 다른 팀으로 view-as 진입 가능.
        </p>
      </header>
      {loading && <p className="text-sm text-slate-500">불러오는 중...</p>}
      {!loading && data.length === 0 && <p className="text-sm text-slate-500">팀이 없음.</p>}
      {!loading && data.length > 0 && (
        <div className="space-y-3">
          {data.map((t) => {
            const isCurrent = t.id === currentTeamId;
            const isViewingNow = t.id === viewAsTeamId;
            return (
              <div key={t.id} className="bg-slate-950 border border-slate-800 rounded p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {t.namePending ? (
                        <span className="text-amber-300">{t.name} · (이름 대기 중)</span>
                      ) : (
                        t.name
                      )}{" "}
                      <span className="text-xs text-slate-500 font-mono">
                        #{t.id} · {t.slug}
                      </span>
                      {isCurrent && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300">
                          내 팀
                        </span>
                      )}
                      {isViewingNow && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-300">
                          view-as
                        </span>
                      )}
                      {t.namePending && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">
                          name-pending
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      생성: {new Date(t.createdAt).toLocaleDateString("ko")} · 멤버 {t.memberCount ?? 0}명
                      {t.deletedAt && (
                        <span className="text-amber-400 ml-2">
                          ● 삭제됨 ({new Date(t.deletedAt).toLocaleDateString("ko")})
                        </span>
                      )}
                    </p>
                  </div>
                  {!isCurrent && !t.deletedAt && (
                    <button
                      onClick={() => switchTo(t.id)}
                      disabled={switchingId === t.id}
                      className="text-xs px-3 py-1 rounded bg-orange-700 hover:bg-orange-800 text-orange-50 font-medium disabled:opacity-50"
                    >
                      {switchingId === t.id ? "Switching…" : isViewingNow ? "Re-enter" : "Switch to"}
                    </button>
                  )}
                </div>
                {t.members && t.members.length > 0 && (
                  <div className="space-y-1">
                    {t.members.map((m) => (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between text-xs text-slate-300 px-2 py-1"
                      >
                        <span>
                          {m.name} <span className="text-slate-500">({m.email})</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-mono ${
                            m.role === "owner"
                              ? "bg-amber-900/40 text-amber-300"
                              : m.role === "admin"
                                ? "bg-indigo-900/40 text-indigo-300"
                                : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {m.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CreateTeamSection() {
  const [teamName, setTeamName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function submit() {
    if (!ownerEmail.trim()) return;
    const trimmedName = teamName.trim();
    if (trimmedName.length > 0 && (trimmedName.length < 4 || trimmedName.length > 20)) {
      setResult({ ok: false, msg: "팀 이름은 4~20자로 입력해주세요 (비우면 어드민이 정함)." });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName: teamName.trim(), ownerEmail: ownerEmail.trim() }),
      });
      const data = (await r.json()) as {
        ok?: boolean;
        teamId?: number;
        invitationId?: number | null;
        emailSent?: boolean;
        emailError?: string | null;
        hadExistingUser?: boolean;
        error?: string;
      };
      if (!r.ok) {
        setResult({ ok: false, msg: `실패: ${data.error}` });
        return;
      }
      if (data.hadExistingUser) {
        setResult({ ok: true, msg: `✓ 팀 #${data.teamId} 생성 + 기존 사용자 즉시 owner 추가됨` });
      } else if (data.emailSent) {
        setResult({ ok: true, msg: `✓ 팀 #${data.teamId} 생성 + 초대 이메일 발송됨` });
      } else {
        setResult({
          ok: true,
          msg: `✓ 팀 #${data.teamId} 생성. 이메일 발송 실패: ${data.emailError ?? "unknown"}. 수동 안내 필요.`,
        });
      }
      setTeamName("");
      setOwnerEmail("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-slate-900 border border-indigo-700/40 rounded-lg p-5 space-y-3">
      <header>
        <h2 className="text-sm font-bold text-indigo-300">새 팀 생성</h2>
        <p className="text-xs text-slate-500 mt-1">
          외부 회사 팀 만들고 첫 owner 에게 초대 이메일 발송. 초대 받은 사용자가 OAuth 가입 시 자동으로 그 팀의 owner 권한 부여 + 자기 데이터 pool 분리.
        </p>
        <p className="text-[11px] text-amber-400/80 mt-1">
          팀 이름을 비우면 초대받은 어드민이 가입 후 본인이 직접 회사명을 정합니다.
        </p>
      </header>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          maxLength={20}
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="팀 이름 4~20자 (선택 — 비우면 어드민이 정함)"
          className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="owner 이메일 (예: kj@thenexa.io)"
          className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm"
        />
        <button
          onClick={submit}
          disabled={!ownerEmail.trim() || submitting}
          className="px-4 py-2 text-sm rounded bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-600"
        >
          {submitting ? "생성 중..." : "팀 생성 + 초대"}
        </button>
      </div>
      {result && (
        <p className={`text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}>{result.msg}</p>
      )}
    </section>
  );
}
