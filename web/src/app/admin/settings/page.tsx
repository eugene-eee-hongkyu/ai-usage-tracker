// /admin/settings — Owner only.
// 권한 부여 + 비활성 사용자 alert + 데이터 보관 기간 (Phase 4.2 에서 활성).

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";

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

export default function AdminSettingsPage() {
  const [activeUsers, setActiveUsers] = useState<UserRow[]>([]);
  const [inactive, setInactive] = useState<InactiveUser[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, i] = await Promise.all([
        fetch("/api/admin/users?status=active&page=1").then((r) => r.json()),
        fetch("/api/admin/inactive-users").then((r) => r.json()),
      ]);
      setActiveUsers((u as { users: UserRow[] }).users);
      setInactive((i as { inactiveUsers: InactiveUser[] }).inactiveUsers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  async function updatePermissions(u: UserRow, perms: { membershipAdmin: boolean; billingAdmin: boolean }) {
    const r = await fetch(`/api/admin/users?id=${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "role_update", role: u.role, permissions: perms }),
    });
    if (!r.ok) {
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      alert(`실패: ${data.error}`);
      return;
    }
    await fetchAll();
  }

  return (
    <div className="space-y-8">
      {/* 권한 부여 */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
        <header>
          <h2 className="text-sm font-bold text-slate-200">권한 관리 (Owner only)</h2>
          <p className="text-xs text-slate-500 mt-1">
            각 사용자에게 Membership-Admin / Billing-Admin 권한 부여. Owner 는 ADMIN_EMAIL env
            기반 (UI 변경 불가).
          </p>
        </header>
        {loading && <p className="text-sm text-slate-500">불러오는 중...</p>}
        {!loading && (
          <div className="space-y-1">
            {activeUsers.map((u) => (
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
                    checked={!!u.permissions?.membershipAdmin}
                    onChange={(e) =>
                      updatePermissions(u, {
                        membershipAdmin: e.target.checked,
                        billingAdmin: !!u.permissions?.billingAdmin,
                      })
                    }
                  />
                  <span>Membership</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!u.permissions?.billingAdmin}
                    onChange={(e) =>
                      updatePermissions(u, {
                        membershipAdmin: !!u.permissions?.membershipAdmin,
                        billingAdmin: e.target.checked,
                      })
                    }
                  />
                  <span>Billing</span>
                </label>
              </div>
            ))}
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
