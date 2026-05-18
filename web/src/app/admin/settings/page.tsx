// /admin/settings — Owner only.
// 권한 부여 (적용 버튼 + Owner 본인 제외) + 비활성 사용자 alert + 데이터 보관 기간 (Phase 4.2 에서 활성).

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  permissions: { membershipAdmin?: boolean; billingAdmin?: boolean };
}

interface InactiveUser {
  id: number;
  email: string;
  name: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

type Draft = { m: boolean; b: boolean };

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const selfId = (session?.user as { id?: number } | undefined)?.id;

  const [activeUsers, setActiveUsers] = useState<UserRow[]>([]);
  const [inactive, setInactive] = useState<InactiveUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, i] = await Promise.all([
        fetch("/api/admin/users?status=active&page=1").then((r) => r.json()),
        fetch("/api/admin/inactive-users").then((r) => r.json()),
      ]);
      const users = (u as { users: UserRow[] }).users;
      setActiveUsers(users);
      setInactive((i as { inactiveUsers: InactiveUser[] }).inactiveUsers);
      // draft 를 서버 값으로 동기화 (적용 후 reload + dirty 초기화 효과)
      const initial: Record<number, Draft> = {};
      for (const usr of users) {
        initial[usr.id] = {
          m: !!usr.permissions?.membershipAdmin,
          b: !!usr.permissions?.billingAdmin,
        };
      }
      setDrafts(initial);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const isDirty = (u: UserRow): boolean => {
    const d = drafts[u.id];
    if (!d) return false;
    return d.m !== !!u.permissions?.membershipAdmin || d.b !== !!u.permissions?.billingAdmin;
  };

  async function applyOne(u: UserRow) {
    const d = drafts[u.id];
    if (!d) return;
    setSavingId(u.id);
    try {
      const r = await fetch(`/api/admin/users?id=${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "role_update",
          role: u.role,
          permissions: { membershipAdmin: d.m, billingAdmin: d.b },
        }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        alert(`실패: ${data.error}`);
        return;
      }
      await fetchAll();
    } finally {
      setSavingId(null);
    }
  }

  // Owner 본인은 변경 불가 — 리스트에서 제외 (ADMIN_EMAIL env 기반이라 UI 토글 무의미).
  const editableUsers = activeUsers.filter((u) => u.id !== selfId);

  return (
    <div className="space-y-8">
      <CreateTeamSection />
      {/* 권한 부여 */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
        <header>
          <h2 className="text-sm font-bold text-slate-200">권한 관리 (Owner only)</h2>
          <p className="text-xs text-slate-500 mt-1">
            각 사용자에게 Membership-Admin / Billing-Admin 권한 부여. 체크 후 <strong>적용</strong> 버튼.
            Owner (본인) 는 ADMIN_EMAIL env 기반이라 UI 변경 불가 — 리스트에서 제외됨.
          </p>
        </header>
        {loading && <p className="text-sm text-slate-500">불러오는 중...</p>}
        {!loading && editableUsers.length === 0 && (
          <p className="text-sm text-slate-500">권한 부여 가능한 사용자가 없음.</p>
        )}
        {!loading && editableUsers.length > 0 && (
          <div className="space-y-1">
            {editableUsers.map((u) => {
              const d = drafts[u.id] ?? { m: false, b: false };
              const dirty = isDirty(u);
              const saving = savingId === u.id;
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.m}
                      disabled={saving}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [u.id]: { ...prev[u.id], m: e.target.checked } }))
                      }
                    />
                    <span>Membership</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.b}
                      disabled={saving}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [u.id]: { ...prev[u.id], b: e.target.checked } }))
                      }
                    />
                    <span>Billing</span>
                  </label>
                  <button
                    onClick={() => applyOne(u)}
                    disabled={!dirty || saving}
                    className="px-3 py-1 text-xs rounded bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-600"
                  >
                    {saving ? "적용 중..." : "적용"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 비활성 사용자 */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
        <header>
          <h2 className="text-sm font-bold text-amber-400">30일+ 비활성 사용자 ({inactive.length})</h2>
          <p className="text-xs text-slate-500 mt-1">
            마지막 sync 가 30일 이전인 활성 사용자. 라이센스 정리 또는 suspend 고려.
          </p>
        </header>
        {inactive.length === 0 ? (
          <p className="text-sm text-slate-500">모든 사용자가 최근 30일 내 sync 중. ✓</p>
        ) : (
          <div className="space-y-1">
            {inactive.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <p className="text-xs text-amber-400">
                  마지막 sync:{" "}
                  {u.lastSyncedAt
                    ? new Date(u.lastSyncedAt).toLocaleDateString("ko")
                    : "없음 (가입 후 한 번도 sync 안 함)"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 데이터 보관 기간 (Phase 4.2 에서 활성) */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3 opacity-50">
        <header>
          <h2 className="text-sm font-bold text-slate-400">데이터 보관 기간 (Phase 4.2)</h2>
          <p className="text-xs text-slate-500 mt-1">
            팀별 데이터 보관 정책. 90일 default. Phase 4.2 (multi-team) 에서 활성화.
          </p>
        </header>
        <select disabled className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm">
          <option>90일 (현재)</option>
          <option>6개월</option>
          <option>1년</option>
          <option>3년</option>
          <option>5년</option>
          <option>무제한</option>
        </select>
      </section>
    </div>
  );
}

// Phase 4.2 M6b — Owner 가 새 팀 생성 + 첫 owner 초대.
// 시범 팀 발송 흐름. 사용자 입력 = 팀 이름 + owner 이메일.
function CreateTeamSection() {
  const [teamName, setTeamName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function submit() {
    if (!teamName.trim() || !ownerEmail.trim()) return;
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
        <h2 className="text-sm font-bold text-indigo-300">새 팀 생성 (Owner only — M6b)</h2>
        <p className="text-xs text-slate-500 mt-1">
          신규 시범 팀 / 외부 회사 팀 만들고 첫 owner 에게 초대 이메일 발송. 초대 받은 사용자가 OAuth 가입 시 자동으로
          그 팀의 owner 권한 부여 + 자기 데이터 pool 분리.
        </p>
      </header>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="팀 이름 (예: ehongarykr team)"
          className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="owner 이메일 (예: ehongarykr@gmail.com)"
          className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm"
        />
        <button
          onClick={submit}
          disabled={!teamName.trim() || !ownerEmail.trim() || submitting}
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
