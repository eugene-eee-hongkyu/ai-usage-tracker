// /platform-admin/all-personal — Personal 사용자 목록 + 검색 + hide 토글 + 랭킹 어드민 뷰.

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

interface PersonalUser {
  userId: number;
  name: string;
  email: string;
  rankingHidden: boolean;
  createdAt: string | null;
  lastSyncedAt: string | null;
  cost30: number;
  tokens30: number;
  activeDays: number;
  cacheHit: number;
  powerIndex: number;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function AllPersonalPage() {
  const [users, setUsers] = useState<PersonalUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<number | null>(null);
  // Multi-provider Phase 2: Provider Tabs.
  const [provider, setProvider] = useState<"claude" | "codex">("claude");
  const [hasCodexData, setHasCodexData] = useState(false);

  function load(q: string, prov: "claude" | "codex") {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (prov === "codex") params.set("provider", "codex");
    const url = params.toString() ? `/api/platform-admin/all-personal?${params}` : "/api/platform-admin/all-personal";
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: { users: PersonalUser[]; hasCodexData?: boolean }) => {
        setUsers(d.users);
        if (d.hasCodexData) setHasCodexData(true);
      })
      .catch((e) => setError(String(e)));
  }

  useEffect(() => {
    load("", provider);
  }, [provider]);

  async function handleHideToggle(userId: number, rankingHidden: boolean) {
    setToggling(userId);
    try {
      const r = await fetch("/api/platform-admin/all-personal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, rankingHidden }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setUsers((prev) =>
        prev?.map((u) => (u.userId === userId ? { ...u, rankingHidden } : u)) ?? null
      );
    } catch (e) {
      console.error("hide toggle failed", e);
    }
    setToggling(null);
  }

  function handleSearch() {
    setUsers(null);
    setError(null);
    load(search, provider);
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-slate-100">All Personal Users</h1>
        <p className="text-xs text-slate-500 mt-1">
          Personal 랭킹 참여자 목록. 실명 + 30일 지표. hide 토글로 랭킹에서 숨기기.
        </p>
      </header>

      {/* Multi-provider Phase 2: Provider Tabs (personal 사용자 중 의미 있는 Codex 1+ 일 때만) */}
      {hasCodexData && (
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider mr-1">provider:</span>
          {(["claude", "codex"] as const).map((prov) => (
            <button
              key={prov}
              data-testid={`all-personal-provider-${prov}`}
              onClick={() => setProvider(prov)}
              className={`text-xs font-mono border rounded px-3 py-1 transition-colors ${
                provider === prov
                  ? "bg-indigo-600 text-white border-indigo-500"
                  : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-500"
              }`}
            >{prov === "claude" ? "Claude Code" : "Codex"}</button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="이름 또는 이메일 검색"
          className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
        />
        <button
          onClick={handleSearch}
          className="px-3 py-1.5 bg-slate-800 rounded text-sm text-slate-300 hover:bg-slate-700 font-mono"
        >
          검색
        </button>
      </div>

      {error && <p className="text-sm text-rose-400 font-mono">로드 실패: {error}</p>}
      {!error && users === null && <p className="text-sm text-neutral-500 font-mono">loading…</p>}

      {users && (
        <div className="text-xs font-mono text-slate-500 mb-2">
          전체 {users.length}명
        </div>
      )}

      {users && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-slate-600 border-b border-slate-800">
                <th className="text-left px-3 py-2">이름</th>
                <th className="text-left px-3 py-2">이메일</th>
                <th className="text-right px-3 py-2">30d Cost</th>
                <th className="text-right px-3 py-2">토큰</th>
                <th className="text-right px-3 py-2">활성일</th>
                <th className="text-right px-3 py-2">활용지수</th>
                <th className="text-right px-3 py-2">캐시</th>
                <th className="text-center px-3 py-2">Hide</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.userId}
                  className={`border-b border-slate-800/50 ${
                    u.rankingHidden ? "opacity-40" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 text-slate-200">{u.name}</td>
                  <td className="px-3 py-2.5 text-slate-400">{u.email}</td>
                  <td className="px-3 py-2.5 text-right text-yellow-400 tabular-nums">${u.cost30.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-cyan-400 tabular-nums">{fmtTokens(u.tokens30)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">{u.activeDays}d</td>
                  <td className="px-3 py-2.5 text-right text-emerald-400 tabular-nums">{u.powerIndex}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-400 tabular-nums">{u.cacheHit}%</td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => handleHideToggle(u.userId, !u.rankingHidden)}
                      disabled={toggling === u.userId}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        u.rankingHidden
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          : "bg-slate-800 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {u.rankingHidden ? "숨김" : "표시"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
