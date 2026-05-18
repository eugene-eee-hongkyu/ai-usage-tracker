// /admin/audit — audit log viewer + Integrity badge.
// 페이지 진입 시 자동 verify_audit_chain() 호출 (cron 없음, 사용자 결정 2026-05-18).

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";

interface AuditRow {
  id: number;
  prevHash: string | null;
  rowHash: string;
  actorUserId: number | null;
  actorType: string;
  action: string;
  targetType: string | null;
  targetId: number | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
  actorEmail: string | null;
  actorName: string | null;
}

interface AuditResp {
  auditLogs: AuditRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  integrity: {
    verified: boolean;
    brokenAtId: string | null;
    expected: string | null;
    actual: string | null;
  };
}

export default function AdminAuditPage() {
  const [data, setData] = useState<AuditResp | null>(null);
  const [page, setPage] = useState(1);
  // draft = 사용자가 input 에 입력 중인 값. applied = 실제 fetch 에 쓰인 값.
  // 글자 칠 때마다 fetch 되는 깜빡임 방지 위해 "검색" 버튼 누르거나 Enter 칠 때만 applied 로 commit.
  const [actionDraft, setActionDraft] = useState("");
  const [actorDraft, setActorDraft] = useState("");
  const [actionApplied, setActionApplied] = useState("");
  const [actorApplied, setActorApplied] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (actionApplied) params.set("action", actionApplied);
      if (actorApplied) params.set("actorQ", actorApplied);
      const r = await fetch(`/api/admin/audit?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as AuditResp);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, actionApplied, actorApplied]);

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  const applySearch = () => {
    setPage(1);
    setActionApplied(actionDraft.trim());
    setActorApplied(actorDraft.trim());
  };

  const resetSearch = () => {
    setActionDraft("");
    setActorDraft("");
    setActionApplied("");
    setActorApplied("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Integrity badge */}
      {data && (
        <div
          className={`rounded-lg p-4 ${
            data.integrity.verified
              ? "bg-emerald-950/40 border border-emerald-700/40"
              : "bg-red-950/40 border border-red-700/40"
          }`}
        >
          {data.integrity.verified ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-400">
                  ✓ Integrity verified
                </p>
                <p className="text-xs text-emerald-300/70 mt-1">
                  Hash chain 무결성 검증 통과. 모든 audit row 가 INSERT 후 변조되지 않음.
                </p>
              </div>
              <button
                onClick={() => fetchAudit()}
                className="px-3 py-1.5 bg-emerald-900/60 hover:bg-emerald-900 text-emerald-200 text-xs rounded"
              >
                재검증
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-bold text-red-400">⚠️ 변조 감지</p>
              <p className="text-xs text-red-300">
                id={data.integrity.brokenAtId} row 의 hash 가 hash chain 과 mismatch.
                누군가 audit_logs 를 직접 수정·삭제했을 가능성. Supabase dashboard 의 최근
                활동 + service_role 접근 로그 검토 필요.
              </p>
              <details className="text-xs text-red-300/70 font-mono">
                <summary className="cursor-pointer">상세</summary>
                <p>
                  expected: <span className="break-all">{data.integrity.expected}</span>
                </p>
                <p>
                  actual: <span className="break-all">{data.integrity.actual}</span>
                </p>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Filter toolbar — Enter 또는 검색 버튼 클릭 시에만 fetch (글자마다 깜빡임 방지) */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={actionDraft}
          onChange={(e) => setActionDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
          placeholder="action 부분 매칭 (예: invitation, user.suspend)"
          className="flex-1 max-w-xs bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm font-mono"
        />
        <input
          type="text"
          value={actorDraft}
          onChange={(e) => setActorDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
          placeholder="actor 이름 / 이메일 / ID"
          className="w-56 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm font-mono"
        />
        <button
          onClick={applySearch}
          className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-sm rounded"
        >
          검색
        </button>
        {(actionApplied || actorApplied) && (
          <button
            onClick={resetSearch}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded"
          >
            초기화
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {loading && <div className="p-8 text-center text-sm text-slate-500">불러오는 중...</div>}
        {!loading && data && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="text-left px-4 py-2">id</th>
                <th className="text-left px-4 py-2">시각</th>
                <th className="text-left px-4 py-2">actor</th>
                <th className="text-left px-4 py-2">action</th>
                <th className="text-left px-4 py-2">target</th>
                <th className="text-left px-4 py-2">metadata</th>
              </tr>
            </thead>
            <tbody>
              {data.auditLogs.map((r) => (
                <tr key={r.id} className="border-b border-slate-800 last:border-0">
                  <td className="px-4 py-2 text-slate-500 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-2 text-slate-400 text-xs">
                    {new Date(r.createdAt).toLocaleString("ko")}
                  </td>
                  <td className="px-4 py-2">
                    {r.actorType === "system" ? (
                      <span className="text-xs text-slate-500">system</span>
                    ) : r.actorEmail ? (
                      <div>
                        <p className="text-slate-200 text-xs">{r.actorName}</p>
                        <p className="text-slate-500 text-xs">{r.actorEmail}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">deleted</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <code className="text-amber-300 text-xs">{r.action}</code>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">
                    {r.targetType && (
                      <span>
                        {r.targetType}#{r.targetId}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {Object.keys(r.metadata).length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-xs text-slate-500">
                          {Object.keys(r.metadata).length} keys
                        </summary>
                        <pre className="text-xs text-slate-400 mt-1 max-w-xs overflow-x-auto">
                          {JSON.stringify(r.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded"
          >
            ←
          </button>
          <span className="text-slate-400">
            {page} / {data.totalPages} (총 {data.total})
          </span>
          <button
            onClick={() => setPage(Math.min(data.totalPages, page + 1))}
            disabled={page === data.totalPages}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
