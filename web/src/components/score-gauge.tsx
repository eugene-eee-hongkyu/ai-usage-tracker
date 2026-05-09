"use client";

// 효율 점수 SVG 원형 게이지 (Whoop / Apple Watch 패턴).
// 색·각도만으로 5초 안 판단 — 단일 focal point. 외부 라이브러리 0.
// 개인 dashboard 와 팀 헤드라인 양쪽에서 공유.

export function scoreHexColor(score: number | null): string {
  if (score === null) return "#525252";
  if (score >= 90) return "#10b981";
  if (score >= 70) return "#84cc16";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

export function scoreLabel(score: number | null): string {
  if (score === null) return "활동 없음";
  if (score >= 90) return "탁월";
  if (score >= 70) return "양호";
  if (score >= 40) return "개선 필요";
  return "경고";
}

export function ScoreGauge({ score, size = 132 }: { score: number | null; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const value = score ?? 0;
  const dash = (value / 100) * C;
  const color = scoreHexColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`효율 점수 ${score ?? "데이터 없음"}`}>
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
