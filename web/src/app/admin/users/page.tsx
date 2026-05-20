// /admin/users — 사용자 관리.
// 리스트 + search/pagination/filter + invite + approve join requests + suspend/delete
// + 30일 grace banner (deletedAt 마킹된 사용자) + type-to-confirm delete.

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface UserRow {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  permissions: { membershipAdmin?: boolean; billingAdmin?: boolean };
  suspendedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  lastSyncedAt: string | null;
  isPlatformAdmin: boolean;
}

interface UserListResp {
  users: UserRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface InvitationRow {
  id: number;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

interface JoinRequestRow {
  id: number;
  email: string;
  teamNameHint: string | null;
  message: string | null;
  status: string;
  createdAt: string;
}

const STATUSES = ["active", "suspended", "deleted", "all"] as const;
type Status = (typeof STATUSES)[number];

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const selfId = session?.user?.id;
  const [users, setUsers] = useState<UserListResp | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<UserRow | null>(null);
  const [inviteModal, setInviteModal] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const usersUrl = `/api/admin/users?q=${encodeURIComponent(q)}&status=${status}&page=${page}`;
      const [u, i, j] = await Promise.all([
        fetch(usersUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch("/api/admin/invitations?status=pending").then((r) =>
          r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
        ),
        fetch("/api/admin/join-requests?status=pending").then((r) =>
          r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
        ),
      ]);
      setUsers(u as UserListResp);
      setInvitations((i as { invitations: InvitationRow[] }).invitations);
      setJoinRequests((j as { joinRequests: JoinRequestRow[] }).joinRequests);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, status, page]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Phase 4.2 M6c — viewAs 상태에서 쓰기 액션 confirm 다이얼로그.
  // 평소 (자기 팀) 작업엔 confirm 없음. 다른 팀 진입 중에만 한 단계 추가.
  function confirmViewAsAction(targetLabel: string, actionLabel: string): boolean {
    const viewAs = (session?.user as { viewAsTeamName?: string | null } | undefined)?.viewAsTeamName;
    if (!viewAs) return true;
    return window.confirm(
      `[${viewAs}] 팀의 데이터를 수정합니다.\n\n대상: ${targetLabel}\n액션: ${actionLabel}\n\n계속하시겠습니까?`
    );
  }

  async function patchUser(id: number, body: Record<string, unknown>) {
    const target = users?.users?.find((u) => u.id === id);
    const targetLabel = target ? `${target.name} (${target.email})` : `id=${id}`;
    const actionLabel = String(body.action ?? "update");
    if (!confirmViewAsAction(targetLabel, actionLabel)) return false;

    const r = await fetch(`/api/admin/users?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      alert(`실패: ${data.error ?? r.status}`);
      return false;
    }
    await fetchAll();
    return true;
  }

  async function patchJoinRequest(id: number, decision: "approved" | "rejected") {
    if (!confirmViewAsAction(`join_request #${id}`, decision)) return;

    const r = await fetch(`/api/admin/join-requests?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!r.ok) {
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      alert(`실패: ${data.error ?? r.status}`);
      return;
    }
    await fetchAll();
  }

  async function cancelInvitation(id: number) {
    if (!confirm("초대를 취소하시겠습니까?")) return;
    const r = await fetch(`/api/admin/invitations?id=${id}`, { method: "DELETE" });
    if (!r.ok) alert("취소 실패");
    await fetchAll();
  }

  return (
    <div className="space-y-8">
      {error && <div className="bg-red-950 border border-red-800 rounded p-3 text-sm">{error}</div>}

      {/* Pending join requests */}
      {joinRequests.length > 0 && (
        <section className="bg-slate-900 border border-amber-700/40 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-amber-400">
            가입 신청 대기 ({joinRequests.length})
          </h2>
          <div className="space-y-2">
            {joinRequests.map((jr) => (
              <div
                key={jr.id}
                className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{jr.email}</p>
                  {jr.teamNameHint && (
                    <p className="text-xs text-slate-500">팀: {jr.teamNameHint}</p>
                  )}
                  {jr.message && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{jr.message}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => patchJoinRequest(jr.id, "approved")}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-emerald-100 text-xs rounded"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => patchJoinRequest(jr.id, "rejected")}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <section className="bg-slate-900 border border-indigo-700/40 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-indigo-400">
            발송 초대 ({invitations.length})
          </h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{inv.email}</p>
                  <p className="text-xs text-slate-500">
                    역할: {inv.role} · 만료: {new Date(inv.expiresAt).toLocaleDateString("ko")}
                  </p>
                </div>
                <button
                  onClick={() => cancelInvitation(inv.id)}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded shrink-0"
                >
                  취소
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="이메일/이름 검색"
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as Status);
              setPage(1);
            }}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setInviteModal(true)}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium"
        >
          + 초대
        </button>
      </div>

      {/* Users table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {loading && (
          <div className="p-8 text-center text-sm text-slate-500">불러오는 중...</div>
        )}
        {!loading && users && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="text-left px-4 py-2">사용자</th>
                <th className="text-left px-4 py-2">역할</th>
                <th className="text-left px-4 py-2">권한</th>
                <th className="text-left px-4 py-2">상태</th>
                <th className="text-left px-4 py-2">마지막 sync</th>
                <th className="text-right px-4 py-2">액션</th>
              </tr>
            </thead>
            <tbody>
              {users.users.map((u) => {
                const isActive = !u.suspendedAt && !u.deletedAt;
                const isDeleted = !!u.deletedAt;
                const inGrace = isDeleted && new Date(u.deletedAt!).getTime() > Date.now() - 30 * 86400000;
                return (
                  <tr key={u.id} className="border-b border-slate-800 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-700" />
                        )}
                        <div>
                          <p className="text-slate-200">{u.name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">
                      {u.isPlatformAdmin ? (
                        <span className="inline-block px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded text-xs font-semibold">
                          Platform Admin
                        </span>
                      ) : (
                        u.role
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">
                      {u.permissions?.membershipAdmin && (
                        <span className="inline-block mr-1 px-1.5 py-0.5 bg-indigo-900/40 text-indigo-300 rounded">
                          Membership
                        </span>
                      )}
                      {u.permissions?.billingAdmin && (
                        <span className="inline-block px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded">
                          Billing
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isActive && <span className="text-emerald-400 text-xs">● Active</span>}
                      {u.suspendedAt && <span className="text-amber-400 text-xs">● Suspended</span>}
                      {isDeleted && (
                        <span className="text-red-400 text-xs">
                          ● Deleted{" "}
                          {inGrace && (
                            <span className="text-slate-500">
                              (grace {Math.ceil((30 * 86400000 - (Date.now() - new Date(u.deletedAt!).getTime())) / 86400000)}d)
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">
                      {u.lastSyncedAt
                        ? new Date(u.lastSyncedAt).toLocaleString("ko-KR", {
                            year: "2-digit",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {u.id === selfId ? (
                        <span className="text-xs text-slate-600">(본인)</span>
                      ) : (
                        <div className="inline-flex gap-1">
                          {!isDeleted && (
                            <>
                              {isActive && (
                                <button
                                  onClick={() => patchUser(u.id, { action: "suspend" })}
                                  className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded"
                                >
                                  Suspend
                                </button>
                              )}
                              {u.suspendedAt && (
                                <button
                                  onClick={() => patchUser(u.id, { action: "unsuspend" })}
                                  className="px-2 py-0.5 bg-emerald-900/60 hover:bg-emerald-900 text-emerald-300 text-xs rounded"
                                >
                                  Unsuspend
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteModal(u)}
                                className="px-2 py-0.5 bg-red-900/60 hover:bg-red-900 text-red-300 text-xs rounded"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {isDeleted && inGrace && (
                            <button
                              onClick={() => patchUser(u.id, { action: "restore" })}
                              className="px-2 py-0.5 bg-emerald-900/60 hover:bg-emerald-900 text-emerald-300 text-xs rounded"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {users && users.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded"
          >
            ←
          </button>
          <span className="text-slate-400">
            {page} / {users.totalPages} (총 {users.total})
          </span>
          <button
            onClick={() => setPage(Math.min(users.totalPages, page + 1))}
            disabled={page === users.totalPages}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded"
          >
            →
          </button>
        </div>
      )}

      {/* Delete modal — type-to-confirm */}
      {deleteModal && (
        <DeleteModal
          user={deleteModal}
          onClose={() => setDeleteModal(null)}
          onConfirm={async (email) => {
            const ok = await patchUser(deleteModal.id, { action: "delete", confirmEmail: email });
            if (ok) setDeleteModal(null);
          }}
        />
      )}

      {/* Invite modal */}
      {inviteModal && (
        <InviteModal
          onClose={() => setInviteModal(false)}
          onSent={() => {
            setInviteModal(false);
            void fetchAll();
          }}
        />
      )}
    </div>
  );
}

function DeleteModal({
  user,
  onClose,
  onConfirm,
}: {
  user: UserRow;
  onClose: () => void;
  onConfirm: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full space-y-4">
        <h2 className="text-lg font-bold text-red-400">사용자 삭제</h2>
        <p className="text-sm text-slate-300">
          <strong className="text-slate-100">{user.name}</strong> ({user.email}) 를 삭제합니다.
        </p>
        <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/40 rounded p-2">
          30일 grace 기간 동안 복구 가능. 이후 영구 삭제.
        </p>
        <p className="text-xs text-slate-400">
          확인을 위해 사용자 이메일을 정확히 입력하세요:
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={user.email}
          className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm font-mono"
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm"
          >
            취소
          </button>
          <button
            onClick={async () => {
              setSubmitting(true);
              await onConfirm(email);
              setSubmitting(false);
            }}
            disabled={email !== user.email || submitting}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-red-100 rounded text-sm"
          >
            {submitting ? "삭제 중..." : "삭제 확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [membershipAdmin, setMembershipAdmin] = useState(false);
  const [billingAdmin, setBillingAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // admin/owner 는 세부 권한 (membershipAdmin / billingAdmin) 중 최소 1개 필수.
  // member 는 권한 없음 — UI 도 숨기고 payload 도 비움.
  const needsPermissions = role !== "member";
  const hasAnyPermission = membershipAdmin || billingAdmin;
  const permissionsValid = !needsPermissions || hasAnyPermission;

  async function send() {
    if (!permissionsValid) {
      setResult(`실패: ${role} 역할은 Membership Admin 또는 Billing Admin 중 최소 1개를 선택해야 합니다.`);
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role,
          permissions: needsPermissions ? { membershipAdmin, billingAdmin } : {},
          locale: "ko",
        }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string; emailSent?: boolean; emailError?: string };
      if (!r.ok) {
        setResult(`실패: ${data.error}`);
      } else {
        setResult(
          data.emailSent
            ? "✓ 초대 발송 완료"
            : `초대 생성됨. 이메일 발송 실패 (${data.emailError ?? "원인 불명"}). DNS verify 후 재시도하거나 토큰을 직접 전달하세요.`
        );
        if (data.ok) {
          setTimeout(onSent, 1500);
        }
      }
    } catch (e) {
      setResult(`실패: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full space-y-4">
        <h2 className="text-lg font-bold">사용자 초대</h2>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-slate-400">이메일</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-slate-400">역할</span>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setResult(null);
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </label>
        {needsPermissions && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              권한 <span className="text-red-400 normal-case">*</span>
              <span className="ml-2 text-[10px] text-slate-500 normal-case">최소 1개 선택</span>
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={membershipAdmin}
                onChange={(e) => {
                  setMembershipAdmin(e.target.checked);
                  setResult(null);
                }}
              />
              <span>Membership Admin (사용자 관리)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={billingAdmin}
                onChange={(e) => {
                  setBillingAdmin(e.target.checked);
                  setResult(null);
                }}
              />
              <span>Billing Admin (cost 자세히 보기)</span>
            </label>
          </div>
        )}
        {result && (
          <p
            className={`text-xs ${
              result.startsWith("✓") ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {result}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm"
          >
            취소
          </button>
          <button
            onClick={send}
            disabled={!email || submitting || !permissionsValid}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-sm"
          >
            {submitting ? "전송 중..." : "발송"}
          </button>
        </div>
      </div>
    </div>
  );
}
