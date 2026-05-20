"use client";

// admin/team > 랭킹 탭 — 30일 윈도우, 다른 팀들과 비교.
//
// 4 카드:
//   1. 팀 활용지수 top 5 (Power Index, 높은 순) — 내 팀 강조 + 못 들어가면 6번째에 표시
//   2. 팀 토큰 단가 최저 top 5 (USD/MTok, 낮은 순) — 동일 패턴
//   3. Top 토큰 사용 멤버 top 10 — 내 팀 멤버는 실명 + 강조, 다른 팀 익명화. 11번째에 우리 팀 1등
//   4. Top 비용 멤버 top 10 — 동일 패턴
//
// 데이터: GET /api/admin/team/ranking (server 측 익명화 적용된 응답).

import { useEffect, useState } from "react";

interface TeamRow {
  id: number;
  displayName: string;
  isMyTeam: boolean;
  powerIndex: number;
  activeMembers: number;
  unitCostUsdPerMTok: number | null;
}
interface MemberRow {
  userId: number;
  teamId: number;
  displayName: string;
  teamDisplayName: string;
  isMyTeam: boolean;
  totalTokens: number;
  totalCostUsd: number;
}
interface RankingResp {
  myTeamId: number | null;
  windowDays: number;
  teams: TeamRow[];
  members: MemberRow[];
}

export function TeamRanking() {
  const [data, setData] = useState<RankingResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/team/ranking")
      .then(async (r) => {
        if (!r.ok) {
          const e = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(e.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) {
    return <p className="text-sm text-red-400">랭킹 로드 실패: {error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-500">불러오는 중...</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        최근 {data.windowDays}일 기준. 다른 팀과 멤버의 이름은 익명 처리됩니다.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TeamPowerRankingCard teams={data.teams} />
        <TeamUnitPriceRankingCard teams={data.teams} />
        <MemberTokensRankingCard members={data.members} myTeamId={data.myTeamId} />
        <MemberCostRankingCard members={data.members} myTeamId={data.myTeamId} />
      </div>
    </div>
  );
}

// 공통 — top N + (들어가지 못한 경우) 우리 팀 N+1 번째 + 몇 등 표시.
function TeamPowerRankingCard({ teams }: { teams: TeamRow[] }) {
  const active = teams.filter((t) => t.powerIndex > 0);
  const sorted = [...active].sort((a, b) => b.powerIndex - a.powerIndex);
  return (
    <RankingCard
      title="팀 활용지수 (Power Index)"
      subtitle="활성 멤버 평균. 높을수록 활발."
      items={sorted}
      keyOf={(t) => t.id}
      isOurs={(t) => t.isMyTeam}
      topN={5}
      renderRow={(t, rank) => (
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-slate-500 font-mono text-xs w-5 shrink-0">{rank}</span>
            <span className={`truncate ${t.isMyTeam ? "text-emerald-300 font-semibold" : "text-slate-300"}`}>
              {t.displayName}
            </span>
            {t.isMyTeam && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 shrink-0">
                내 팀
              </span>
            )}
          </span>
          <span className="font-mono text-sm text-slate-200 shrink-0">{t.powerIndex}</span>
        </div>
      )}
    />
  );
}

function TeamUnitPriceRankingCard({ teams }: { teams: TeamRow[] }) {
  const valid = teams.filter((t) => t.unitCostUsdPerMTok != null);
  const sorted = [...valid].sort(
    (a, b) => (a.unitCostUsdPerMTok ?? Infinity) - (b.unitCostUsdPerMTok ?? Infinity)
  );
  return (
    <RankingCard
      title="팀 토큰 단가 최저"
      subtitle="USD / 1M tokens (cache 포함). 낮을수록 효율적."
      items={sorted}
      keyOf={(t) => t.id}
      isOurs={(t) => t.isMyTeam}
      topN={5}
      renderRow={(t, rank) => (
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-slate-500 font-mono text-xs w-5 shrink-0">{rank}</span>
            <span className={`truncate ${t.isMyTeam ? "text-emerald-300 font-semibold" : "text-slate-300"}`}>
              {t.displayName}
            </span>
            {t.isMyTeam && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 shrink-0">
                내 팀
              </span>
            )}
          </span>
          <span className="font-mono text-sm text-slate-200 shrink-0">
            ${t.unitCostUsdPerMTok!.toFixed(2)}
          </span>
        </div>
      )}
    />
  );
}

function MemberTokensRankingCard({ members, myTeamId }: { members: MemberRow[]; myTeamId: number | null }) {
  const active = members.filter((m) => m.totalTokens > 0);
  const sorted = [...active].sort((a, b) => b.totalTokens - a.totalTokens);
  return (
    <MemberRankingCard
      title="Top 토큰 사용자 (30일)"
      subtitle="개인별 30일 누적 토큰 합."
      members={sorted}
      myTeamId={myTeamId}
      formatValue={(m) => fmtTokens(m.totalTokens)}
    />
  );
}

function MemberCostRankingCard({ members, myTeamId }: { members: MemberRow[]; myTeamId: number | null }) {
  const active = members.filter((m) => m.totalCostUsd > 0);
  const sorted = [...active].sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  return (
    <MemberRankingCard
      title="Top API 환산 비용 (30일)"
      subtitle="개인별 30일 누적 비용 (USD)."
      members={sorted}
      myTeamId={myTeamId}
      formatValue={(m) => `$${m.totalCostUsd.toFixed(2)}`}
    />
  );
}

// 공통 멤버 랭킹 카드 — top 10 + 우리 팀 안 들어가면 11번째 표시 + 우리팀 1등 표기.
function MemberRankingCard({
  title,
  subtitle,
  members,
  myTeamId,
  formatValue,
}: {
  title: string;
  subtitle: string;
  members: MemberRow[];
  myTeamId: number | null;
  formatValue: (m: MemberRow) => string;
}) {
  const TOP = 10;
  const top = members.slice(0, TOP);
  const myInTop = top.some((m) => m.isMyTeam);
  // 우리 팀 멤버 중 가장 높은 순위 (전체에서)
  const myBestIdx = members.findIndex((m) => m.isMyTeam);
  const myBest = myBestIdx >= 0 ? members[myBestIdx] : null;
  const myBestRank = myBestIdx >= 0 ? myBestIdx + 1 : null;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
      <header>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </header>
      {top.length === 0 ? (
        <p className="text-xs text-slate-500">데이터 없음.</p>
      ) : (
        <ol className="space-y-1.5">
          {top.map((m, i) => (
            <li key={`${m.teamId}-${m.userId}`}>
              <MemberRow m={m} rank={i + 1} value={formatValue(m)} />
            </li>
          ))}
          {!myInTop && myBest && myBestRank && (
            <>
              <li className="text-center text-xs text-slate-600 py-1">…</li>
              <li>
                <MemberRow m={myBest} rank={myBestRank} value={formatValue(myBest)} />
              </li>
              <li className="text-[11px] text-slate-500 text-center pt-1">
                우리 팀 1등은 전체 {myBestRank}등
              </li>
            </>
          )}
        </ol>
      )}
    </section>
  );
}

function MemberRow({ m, rank, value }: { m: MemberRow; rank: number; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-slate-500 font-mono text-xs w-6 shrink-0">{rank}</span>
        <span className={`truncate ${m.isMyTeam ? "text-emerald-300 font-semibold" : "text-slate-300"}`}>
          {m.displayName}
        </span>
        <span className={`text-[10px] truncate ${m.isMyTeam ? "text-emerald-400/70" : "text-slate-500"}`}>
          {m.teamDisplayName}
        </span>
        {m.isMyTeam && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 shrink-0">
            내 팀
          </span>
        )}
      </span>
      <span className="font-mono text-xs text-slate-200 shrink-0">{value}</span>
    </div>
  );
}

// 팀 랭킹 카드 generic.
function RankingCard<T>({
  title,
  subtitle,
  items,
  keyOf,
  isOurs,
  topN,
  renderRow,
}: {
  title: string;
  subtitle: string;
  items: T[];
  keyOf: (t: T) => string | number;
  isOurs: (t: T) => boolean;
  topN: number;
  renderRow: (t: T, rank: number) => React.ReactNode;
}) {
  const top = items.slice(0, topN);
  const oursInTop = top.some(isOurs);
  const ourIdx = items.findIndex(isOurs);
  const ourItem = ourIdx >= 0 ? items[ourIdx] : null;
  const ourRank = ourIdx >= 0 ? ourIdx + 1 : null;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
      <header>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </header>
      {top.length === 0 ? (
        <p className="text-xs text-slate-500">데이터 없음.</p>
      ) : (
        <ol className="space-y-1.5">
          {top.map((t, i) => (
            <li key={keyOf(t)}>{renderRow(t, i + 1)}</li>
          ))}
          {!oursInTop && ourItem && ourRank && (
            <>
              <li className="text-center text-xs text-slate-600 py-1">…</li>
              <li>{renderRow(ourItem, ourRank)}</li>
            </>
          )}
        </ol>
      )}
    </section>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
