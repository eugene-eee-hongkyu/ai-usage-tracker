"use client";

// 효율 점수 SVG 원형 게이지 (Whoop / Apple Watch 패턴).
// 색·각도만으로 5초 안 판단 — 단일 focal point. 외부 라이브러리 0.
// 개인 dashboard 와 팀 헤드라인 양쪽에서 공유.

import { useMessages } from "@/lib/use-i18n";
import type { Messages } from "@/lib/i18n";

// 5단계 라벨 — 게이지 점수와 EFFICIENCY 카드 배지에서 공유.
// 두 위치 영원히 동기화 (이전 computeGrade 별도 공식 폐기 후 통합).
export function scoreHexColor(score: number | null): string {
  if (score === null) return "#525252";
  if (score >= 90) return "#10b981";   // emerald — exemplary
  if (score >= 75) return "#84cc16";   // lime — good
  if (score >= 55) return "#eab308";   // yellow — moderate
  if (score >= 35) return "#f97316";   // orange — needs work
  return "#ef4444";                    // red — warning
}

// 라벨 — m 인자가 있으면 i18n, 없으면 default 영어. type-safe.
export function scoreLabel(score: number | null, m?: Messages): string {
  const g = m?.grades;
  if (score === null) return g?.noActivity ?? "No activity";
  if (score >= 90) return g?.exemplary ?? "Exemplary";
  if (score >= 75) return g?.good ?? "Good";
  if (score >= 55) return g?.moderate ?? "Moderate";
  if (score >= 35) return g?.needsWork ?? "Needs work";
  return g?.warning ?? "Warning";
}

export function ScoreGauge({ score, size = 132 }: { score: number | null; size?: number }) {
  const { m } = useMessages();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const value = score ?? 0;
  const dash = (value / 100) * C;
  const color = scoreHexColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Score ${score ?? m.grades.noData}`}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
        {score !== null && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${C}`}
            strokeLinecap="round"
          />
        )}
      </g>
      <text
        x={cx} y={cy - 2}
        textAnchor="middle" dominantBaseline="middle"
        fill={color}
        fontSize={size * 0.34}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >{score ?? "─"}</text>
      <text
        x={cx} y={cy + size * 0.22}
        textAnchor="middle" dominantBaseline="middle"
        fill="#737373"
        fontSize={size * 0.09}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >/ 100</text>
    </svg>
  );
}
