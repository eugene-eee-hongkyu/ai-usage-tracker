// /platform-admin/all-teams — 모든 팀의 핵심 위젯 비교 화면. Platform Admin 전용.
// 각 팀마다 4개 위젯: 팀활용지수 hero · 업계비교 · cost(멤버별) · by-member stacked area.
// 정렬: 팀 활용지수 내림차순. 데이터 없는 팀은 맨 뒤.
// 데이터 fetch: /api/team?teamId=N (admin 전용 query) — 팀별 병렬.

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { TeamComparisonRow, type TeamRowData } from "@/components/team-comparison-row";
import { ProviderSegmentedControl } from "@/components/provider-segmented-control";
import { useProviderPreference } from "@/lib/use-provider-preference";

type Period = "today" | "8days" | "month" | "30days" | "all";

interface TeamListItem {
  id: number;
  name: string;
  slug: string;
  type: string;
  deletedAt: string | null;
}

interface TeamFetched {
  teamId: number;
  teamName: string;
  data: TeamRowData | null;
  error: string | null;
}

const DEFAULT_PERIOD: Period = "month";

export default function PlatformAdminAllTeamsPage() {
  const { data: session } = useSession();
  const myCurrentTeamId =
    (session?.user as { currentTeamId?: number | null } | undefined)?.currentTeamId ?? null;
  const myViewAsTeamId =
    (session?.user as { viewAsTeamId?: number | null } | undefined)?.viewAsTeamId ?? null;
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  // Multi-provider — 마지막 선택 localStorage 기억 (전 화면 공유).
  const [provider, setProvider] = useProviderPreference();
  const [teams, setTeams] = useState<TeamFetched[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navigatingTeamId, setNavigatingTeamId] = useState<number | null>(null);
  // 시스템 전체 has 플래그 — /api/admin/teams GET 응답에서 받음.
  const [hasCodexData, setHasCodexData] = useState(false);
  const [hasClaudeData, setHasClaudeData] = useState(true);

  // 팀명 클릭 → 해당 팀 view-as 진입 (본인 팀이면 view-as exit) → /team 으로 full nav.
  // /platform-admin/all-users 의 handleCardClick 패턴 동일 (route 만 /team).
  async function handleTeamClick(teamId: number) {
    if (navigatingTeamId !== null) return;
    setNavigatingTeamId(teamId);
    try {
      const sameTeam = myCurrentTeamId !== null && teamId === myCurrentTeamId;
      if (sameTeam) {
        if (myViewAsTeamId && myViewAsTeamId !== myCurrentTeamId) {
          await fetch("/api/admin/platform/exit-view", { method: "POST" });
        }
      } else {
        const r = await fetch("/api/admin/platform/switch-team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId }),
        });
        if (!r.ok) throw new Error(String(r.status));
      }
      // session.viewAsTeamName 갱신 지연 회피 위해 full nav.
      window.location.href = "/team";
    } catch (e) {
      console.error("team navigation failed", e);
      setNavigatingTeamId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setTeams(null);
    setLoadError(null);

    (async () => {
      const listRes = await fetch("/api/admin/teams").catch(() => null);
      if (!listRes || !listRes.ok) {
        if (!cancelled) setLoadError(`팀 목록 로드 실패 (${listRes?.status ?? "network"})`);
        return;
      }
      const listJson = (await listRes.json()) as { teams: TeamListItem[]; hasCodexData?: boolean; hasClaudeData?: boolean };
      const active = listJson.teams.filter((t) => !t.deletedAt && t.type !== "personal");
      if (!cancelled) {
        setHasCodexData(listJson.hasCodexData ?? false);
        setHasClaudeData(listJson.hasClaudeData ?? true);
      }

      const fetched: TeamFetched[] = await Promise.all(
        active.map(async (t) => {
          try {
            // provider query 추가 — 옛 코드는 항상 claude scope 만 fetch 했음. Codex 사용 팀이
            // 있어도 이 화면에서 안 보이던 버그 수정.
            const r = await fetch(`/api/team?teamId=${t.id}&period=${period}${provider === "codex" ? "&provider=codex" : ""}`);
            if (!r.ok) return { teamId: t.id, teamName: t.name, data: null, error: String(r.status) };
            const d = (await r.json()) as TeamRowData & { error?: string; teamName?: string };
            if (d.error) return { teamId: t.id, teamName: t.name, data: null, error: d.error };
            return {
              teamId: t.id,
              teamName: d.teamName ?? t.name,
              data: d,
              error: null,
            };
          } catch (e) {
            return { teamId: t.id, teamName: t.name, data: null, error: String(e) };
          }
        })
      );

      if (cancelled) return;

      // 활용지수 desc 정렬. teamUsage 없는 팀은 -1 처리해서 맨 뒤.
      fetched.sort((a, b) => {
        const pa = a.data?.teamUsage?.powerIndex ?? -1;
        const pb = b.data?.teamUsage?.powerIndex ?? -1;
        return pb - pa;
      });

      setTeams(fetched);
    })();

    return () => {
      cancelled = true;
    };
  }, [period, provider]);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-100">All Teams · 비교</h1>
          <p className="text-xs text-slate-500 mt-1">
            모든 팀의 활용지수 · 업계비교 · cost · 멤버별 cost 추이. 활용지수 내림차순.
          </p>
        </div>
        <PeriodSwitcher period={period} onChange={setPeriod} />
      </header>
      {/* Provider segmented control — 항상 표시. 옛 코드는 provider 자체가 없어 항상 claude scope.
          Codex 사용 팀 health check 누락 버그 수정. 토글 시 setTeams(null) 로 옛 응답 폐기. */}
      <ProviderSegmentedControl
        value={provider}
        onChange={(p) => {
          if (p !== provider) setTeams(null);
          setProvider(p);
        }}
        hasClaudeData={hasClaudeData}
        hasCodexData={hasCodexData}
        testIdPrefix="all-teams-provider"
      />

      {loadError && (
        <div className="text-sm text-rose-400 font-mono">Failed to load: {loadError}</div>
      )}

      {!loadError && teams === null && (
        <div className="text-sm text-neutral-500 font-mono">loading teams…</div>
      )}

      {teams && teams.length === 0 && (
        <div className="text-sm text-neutral-500 font-mono">팀이 없습니다.</div>
      )}

      {teams && teams.map((t) => (
        <div key={t.teamId} className="bg-slate-950">
          {t.data ? (
            <TeamComparisonRow
              teamName={t.teamName}
              data={t.data}
              period={period}
              onTeamNameClick={() => handleTeamClick(t.teamId)}
              isNavigating={navigatingTeamId === t.teamId}
            />
          ) : (
            <section className="border border-rose-900/40 rounded bg-rose-950/10 p-4">
              <h2 className="text-base font-bold text-slate-200">{t.teamName}</h2>
              <p className="text-xs font-mono text-rose-400 mt-1">로드 실패: {t.error ?? "unknown"}</p>
            </section>
          )}
        </div>
      ))}
    </div>
  );
}

function PeriodSwitcher({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const opts: Array<{ value: Period; label: string }> = [
    { value: "today",  label: "오늘" },
    { value: "8days",  label: "8일" },
    { value: "month",  label: "이번 달" },
    { value: "30days", label: "30일" },
    { value: "all",    label: "전체" },
  ];
  return (
    <div className="flex gap-1">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-xs px-2 py-1 rounded font-mono transition-colors ${
            period === o.value
              ? "bg-slate-700 text-slate-100"
              : "bg-slate-900 text-slate-500 hover:text-slate-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
