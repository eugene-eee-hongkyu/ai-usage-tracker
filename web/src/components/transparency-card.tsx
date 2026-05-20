// admin-v1 (Phase 4.1 M5) — manager view transparency card.
// 본인 dashboard 안. "당신의 admin 이 보는 것 / 못 보는 것" 명시.
//
// 디자인 변경 (2026-05): 항상 데이터 카드와 동등한 시각 위계로 표시되면 부담.
// <details> collapsible footer 패턴 — 평소 한 줄 (footer 격) + 클릭 시 expand.

"use client";

import { useMessages } from "@/lib/use-i18n";

export function TransparencyCard() {
  const { locale } = useMessages();
  const ko = locale !== "en";

  return (
    <details className="group border-t border-neutral-800 py-3 text-xs">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-neutral-500 hover:text-neutral-300 transition-colors select-none">
        <span className="font-mono uppercase tracking-wider opacity-70">
          ⓘ {ko ? "당신의 admin 이 볼 수 있는 데이터" : "What your admin can see"}
        </span>
        <span className="text-[10px] opacity-60 group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pl-1">
        <div>
          <p className="text-emerald-400/90 font-semibold mb-2 text-xs">
            {ko ? "보이는 것" : "Visible"}
          </p>
          <ul className="space-y-1 text-slate-400">
            <li>· {ko ? "기간 합산 비용 (8일 / 30일)" : "Period total cost (8d / 30d)"}</li>
            <li>· {ko ? "효율 등급 (탁월 / 양호 / 낮음)" : "Efficiency tier (Exemplary / Good / Low)"}</li>
            <li>· {ko ? "활성일 + 마지막 sync 시각" : "Active days + last sync time"}</li>
            <li>· {ko ? "모델별 사용 비율" : "Model usage ratio"}</li>
          </ul>
        </div>
        <div>
          <p className="text-slate-400 font-semibold mb-2 text-xs">
            {ko ? "보이지 않는 것" : "Not visible"}
          </p>
          <ul className="space-y-1 text-slate-500">
            <li>· {ko ? "세션 prompt 내용 (Anthropic 에만 보관)" : "Session prompt content (Anthropic only)"}</li>
            <li>· {ko ? "도구 사용 상세 (BY ACTIVITY 카드는 본인만)" : "Tool usage detail (BY ACTIVITY is personal only)"}</li>
            <li>· {ko ? "개별 세션 raw JSON" : "Individual session raw JSON"}</li>
          </ul>
        </div>
      </div>
    </details>
  );
}
