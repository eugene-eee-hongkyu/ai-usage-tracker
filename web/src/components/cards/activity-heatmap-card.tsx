"use client";

import React from "react";
import { ActivityCalendar } from "react-activity-calendar";
import { tmpl } from "@/lib/dashboard-format";
import { useMessages } from "@/lib/use-i18n";
import type { DashboardData } from "@/components/dashboard-view";

// dashboard-view.tsx 의 activityHeatmapBlock 추출. 24주 개인 활동 히트맵 (비용 기준).
// heatmapDaily 만 props 로 받는다. 데이터 없으면 null 반환 (원본은 <div /> 였으나
// 호출 측 {activityHeatmapBlock} / return activityHeatmapBlock 모두 falsy 를 허용).

export function ActivityHeatmapCard({ heatmapDaily }: { heatmapDaily: DashboardData["heatmapDaily"] }) {
  const { m: t } = useMessages();

  if ((heatmapDaily ?? []).length === 0) return null;

  const calData = (heatmapDaily ?? []).map((row) => {
    const cost = row.cost;
    // 임계 근거 (외부 + 내부 데이터):
    //  - level 1 <$5: Anthropic 평균 사용자 ($6) 의 절반 이하
    //  - level 2 $5~25: Anthropic 평균 ~ 엔터 평균 ($6~$13) 포함
    //  - level 3 $25~100: 엔터 90th ($30) 이상 ~ 우리 p75 ($89) 위
    //  - level 4 $100+: 외부 99th + 우리 p90 ($154) + "엄청 했음"
    const level: 0 | 1 | 2 | 3 | 4 =
      cost === 0 ? 0 :
      cost < 5 ? 1 :
      cost < 25 ? 2 :
      cost < 100 ? 3 :
      4;
    return { date: row.date, count: Math.round(cost * 100), level };
  });

  return (
    <div data-testid="dash-card-activity-heatmap" data-track-dwell="activity_heatmap" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-indigo-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800">
        <span data-testid="dash-heatmap-activity" className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">{tmpl(t.dashboardView.activityHeatmapLabel, { weeks: Math.round((heatmapDaily ?? []).length / 7) })}</span>
      </div>
      <div className="p-3 flex justify-center [&>article]:!items-center">
        <ActivityCalendar
          data={calData}
          colorScheme="dark"
          theme={{ dark: ["#1e293b", "#4338ca", "#6366f1", "#818cf8", "#a5b4fc"] }}
          labels={{ legend: { less: "$0", more: "$100+" } }}
          showWeekdayLabels
          blockSize={14}
          blockMargin={4}
          showTotalCount={false}
          renderBlock={(block, activity) => {
            // today 셀은 amber outline 으로 강조 — "오늘 어디?" 즉시 파악.
            // hover 시 tooltip 으로 그 날 cost 표시 (잔디 패턴과 동일).
            const todayKey = new Date().toISOString().slice(0, 10);
            const isToday = activity.date === todayKey;
            const cost = activity.count / 100; // calData 에서 *100 했던 거 복원
            const label = activity.level === 0
              ? `${tmpl(t.dashboardView.dayCellNoActivity, { date: activity.date })}${isToday ? t.dashboardView.todaySuffix : ""}`
              : `${tmpl(t.dashboardView.dayCellCost, { date: activity.date, cost: cost.toFixed(2) })}${isToday ? t.dashboardView.todaySuffix : ""}`;
            return isToday
              ? React.cloneElement(block, { stroke: "#fbbf24", strokeWidth: 1.5 }, <title>{label}</title>)
              : React.cloneElement(block, {}, <title>{label}</title>);
          }}
        />
      </div>
    </div>
  );
}
