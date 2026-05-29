"use client";

// 미인증 첫 방문자용 랜딩 — hero / 3 가치 카드 / 신뢰 한 줄 / CTA / footer 링크.
// ai.z21labs.world 의 풀 마케팅 페이지에서 핵심 5섹션만 추출 — "30초 이해 후 try" 흐름.
// 인증된 사용자는 page.tsx 에서 /dashboard 로 redirect 처리되어 여기 안 도달.

import Link from "next/link";
import { useEffect } from "react";
import { useMessages } from "@/lib/use-i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { track, EVENTS } from "@/lib/analytics/mixpanel";

export function Landing() {
  const { m } = useMessages();
  const t = m.landing;

  useEffect(() => {
    track(EVENTS.LANDING_VIEW);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="absolute top-4 right-4 z-10">
        <LocaleSwitcher variant="nav" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-12 max-w-4xl mx-auto w-full">
        {/* Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-100 leading-tight">
            {t.heroTitle}
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            {t.heroSubtitle}
          </p>
        </section>

        {/* 3 카드 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {[
            { title: t.cardUsageTitle, body: t.cardUsageBody },
            { title: t.cardGlobalTitle, body: t.cardGlobalBody },
            { title: t.cardEfficiencyTitle, body: t.cardEfficiencyBody },
          ].map((c, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-2"
            >
              <h3 className="text-sm font-semibold text-slate-100">{c.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </section>

        {/* 신뢰 한 줄 */}
        <section className="text-center max-w-2xl">
          <p className="text-xs text-slate-500 leading-relaxed">🔒 {t.trust}</p>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-2">
          <Link
            href="/login"
            data-testid="landing-cta"
            onClick={() => track(EVENTS.LANDING_CTA_CLICK)}
            className="px-8 py-3 bg-slate-100 text-slate-900 rounded-lg font-semibold hover:bg-white transition-colors"
          >
            {t.cta}
          </Link>
          <p className="text-xs text-slate-500">{t.ctaSub}</p>
        </section>

        {/* Team funnel — 팀 도입 검토자는 ai.z21labs.world 의 풀 마케팅으로 분기 */}
        <section className="text-center">
          <p className="text-xs text-slate-500">
            {t.teamFunnel}{" "}
            <a
              href={`https://${t.teamFunnelLink}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="landing-team-funnel"
              onClick={() => track(EVENTS.LANDING_TEAM_FUNNEL_CLICK)}
              className="text-slate-300 hover:text-slate-100 underline underline-offset-2 font-medium"
            >
              {t.teamFunnelLink} →
            </a>
          </p>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-slate-600">
        <span>{t.learnMore} </span>
        <a
          href={`https://${t.learnMoreLink}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-500 hover:text-slate-300 underline underline-offset-2"
        >
          {t.learnMoreLink}
        </a>
        <span className="text-slate-800 mx-2">·</span>
        <a
          href="https://github.com/eugene-eee-hongkyu/ai-usage-tracker"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-500 hover:text-slate-300 underline underline-offset-2"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
