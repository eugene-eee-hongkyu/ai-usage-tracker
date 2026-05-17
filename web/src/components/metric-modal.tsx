"use client";

import { useEffect } from "react";
import { useMessages } from "@/lib/use-i18n";
import type { Messages } from "@/lib/i18n";

// 5단계 grade — internal identifier 영어.
type GradeLevel = "exemplary" | "good" | "moderate" | "insufficient" | "warning";
type GradeRow = { grade: GradeLevel; range: string; label: string };

const GRADE_ROW_COLORS: Record<GradeLevel, { bg: string; gradeText: string; contentText: string }> = {
  exemplary:    { bg: "bg-emerald-950/60", gradeText: "text-emerald-300", contentText: "text-emerald-200" },
  good:         { bg: "bg-green-950/60",   gradeText: "text-green-300",   contentText: "text-green-200" },
  moderate:     { bg: "bg-yellow-950/60",  gradeText: "text-yellow-300",  contentText: "text-yellow-200" },
  insufficient: { bg: "bg-orange-950/60",  gradeText: "text-orange-300",  contentText: "text-orange-200" },
  warning:      { bg: "bg-red-950/60",     gradeText: "text-red-300",     contentText: "text-red-200" },
};

function gradeLabel(g: GradeLevel, m: Messages): string {
  switch (g) {
    case "exemplary":    return m.grades.exemplary;
    case "good":         return m.grades.good;
    case "moderate":     return m.grades.moderate;
    case "insufficient": return m.grades.insufficient;
    case "warning":      return m.grades.warning;
  }
}

function tmpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// Bold-marked text **like this** 를 <strong> 로 변환. 다른 markdown 은 무시.
// 산문에 강조 한두 개 박는 용도.
function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i} className="text-slate-300">{p}</strong> : p
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg my-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800 transition-colors"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-5 space-y-6 text-sm">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-slate-200 font-semibold text-xs uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function GradeTable({ rows, currentGrade, m }: { rows: GradeRow[]; currentGrade: GradeLevel; m: Messages }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="text-slate-600">
          <th className="text-left py-1.5 w-20 font-normal">{m.common.grade}</th>
          <th className="text-left py-1.5 w-28 font-normal">{m.common.range}</th>
          <th className="text-left py-1.5 font-normal">{m.common.description}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const cur = row.grade === currentGrade;
          const style = GRADE_ROW_COLORS[row.grade];
          return (
            <tr key={row.grade} className={cur ? style.bg : ""}>
              <td className={`py-1.5 pl-2 rounded-l font-bold ${cur ? style.gradeText : "text-slate-500"}`}>
                {gradeLabel(row.grade, m)}
              </td>
              <td className={`py-1.5 ${cur ? style.contentText : "text-slate-400"}`}>{row.range}</td>
              <td className={`py-1.5 pr-2 rounded-r ${cur ? `${style.contentText} font-medium` : "text-slate-500"}`}>
                {row.label}{cur && <span className={`ml-1.5 ${style.gradeText}`}>{m.grades.current}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full bg-indigo-900 text-indigo-300 text-xs flex items-center justify-center font-bold">
        {n}
      </span>
      <p className="text-slate-400 leading-relaxed text-xs">{children}</p>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded text-xs font-mono">{children}</code>;
}

function Ref({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
      {children}
    </a>
  );
}

function cacheHitGrade(v: number): GradeLevel {
  if (v >= 96) return "exemplary";
  if (v >= 90) return "good";
  if (v >= 80) return "moderate";
  if (v >= 60) return "insufficient";
  return "warning";
}

function oneShotGrade(v: number): GradeLevel {
  if (v >= 80) return "exemplary";
  if (v >= 40) return "moderate";
  return "warning";
}

function costPerSessionGrade(v: number): GradeLevel {
  if (v < 25) return "exemplary";
  if (v < 100) return "moderate";
  return "warning";
}

export function CacheHitModal({ value, onClose, methodsOnly = false }: { value: number; onClose: () => void; methodsOnly?: boolean }) {
  const { m } = useMessages();
  const grade = cacheHitGrade(value);
  const label = m.metricModal.cacheHit.label;
  const title = methodsOnly
    ? tmpl(m.metricModal.common.methodsTitle, { label, action: m.metricModal.common.howTo })
    : tmpl(m.metricModal.common.detailsTitle, { label });
  const goodNote = value >= 90
    ? <strong className="text-slate-300">{value.toFixed(1)}% — {m.grades.exemplary}.</strong>
    : null;

  return (
    <ModalShell title={title} onClose={onClose}>
      {!methodsOnly && (
        <Section title={tmpl(m.metricModal.common.what, { label })}>
          <p className="text-slate-400 leading-relaxed text-xs">
            {m.metricModal.cacheHit.definition}
          </p>
          <p className="text-slate-400 leading-relaxed text-xs">
            {m.metricModal.cacheHit.definitionCacheLine}{" "}
            <strong className="text-slate-300">{m.metricModal.cacheHit.definitionExplain}</strong>.
          </p>
          <div className="bg-slate-800 rounded px-3 py-2 text-xs text-slate-300 font-mono leading-relaxed">
            {m.metricModal.cacheHit.formula}
          </div>
          <p className="text-slate-400 leading-relaxed text-xs">
            {tmpl(m.metricModal.common.currentSession, { val: value.toFixed(1), goodNote: "" })
              .split("{goodNote}")[0]}
            {goodNote}{" "}
            <Ref href="https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code">{m.common.source}</Ref>
          </p>
          <p className="text-slate-600 text-[10px] leading-relaxed">
            {m.metricModal.common.noteCacheNonStandard}
          </p>
        </Section>
      )}

      <Section title={m.metricModal.common.howTo}>
        <p className="text-xs text-slate-500 mb-2">
          {m.metricModal.cacheHit.methodsLead}
        </p>
        <div className="space-y-2.5">
          <Step n={1}>{renderBold(m.metricModal.cacheHit.step1)}</Step>
          <Step n={2}>{renderBold(m.metricModal.cacheHit.step2)}</Step>
          <Step n={3}>{renderBold(m.metricModal.cacheHit.step3)}</Step>
          <Step n={4}>{renderBold(m.metricModal.cacheHit.step4)}</Step>
          <Step n={5}>{renderBold(m.metricModal.cacheHit.step5)}</Step>
        </div>
      </Section>

      {!methodsOnly && (
        <Section title={m.metricModal.common.grade}>
          <GradeTable
            m={m}
            rows={[
              { grade: "exemplary",    range: "96%+",     label: m.metricModal.cacheHit.grade1 },
              { grade: "good",         range: "90~95%",   label: m.metricModal.cacheHit.grade2 },
              { grade: "moderate",     range: "80~89%",   label: m.metricModal.cacheHit.grade3 },
              { grade: "insufficient", range: "60~79%",   label: m.metricModal.cacheHit.grade4 },
              { grade: "warning",      range: "<60%",     label: m.metricModal.cacheHit.grade5 },
            ]}
            currentGrade={grade}
          />
          <p className="text-xs text-slate-600 mt-2">
            <Ref href="https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code">
              {m.metricModal.common.sourceCamp}
            </Ref>
          </p>
        </Section>
      )}
    </ModalShell>
  );
}

export function OneShotRateModal({ value, onClose, methodsOnly = false }: { value: number; onClose: () => void; methodsOnly?: boolean }) {
  const { m } = useMessages();
  const grade = oneShotGrade(value);
  const label = m.metricModal.oneShot.label;
  const title = methodsOnly
    ? tmpl(m.metricModal.common.methodsTitle, { label, action: m.metricModal.common.howTo })
    : tmpl(m.metricModal.common.detailsTitle, { label });

  return (
    <ModalShell title={title} onClose={onClose}>
      {!methodsOnly && (
        <Section title={tmpl(m.metricModal.common.what, { label })}>
          <p className="text-slate-400 leading-relaxed text-xs">{renderBold(m.metricModal.oneShot.def1)}</p>
          <p className="text-slate-400 leading-relaxed text-xs">{renderBold(m.metricModal.oneShot.def2)}</p>
          <div className="bg-slate-800 rounded px-3 py-2 text-xs text-slate-300 font-mono leading-relaxed">
            {m.metricModal.oneShot.formula}
          </div>
          <p className="text-slate-400 leading-relaxed text-xs">{renderBold(m.metricModal.oneShot.def3)}</p>
        </Section>
      )}

      <Section title={m.metricModal.common.howTo}>
        <p className="text-xs text-slate-500 mb-2">{renderBold(m.metricModal.oneShot.methodsLead)}</p>
        <div className="space-y-2.5">
          <Step n={1}>{renderBold(m.metricModal.oneShot.step1)}</Step>
          <Step n={2}>{renderBold(m.metricModal.oneShot.step2)}</Step>
          <Step n={3}>{renderBold(m.metricModal.oneShot.step3)}</Step>
          <Step n={4}>{renderBold(m.metricModal.oneShot.step4)}</Step>
          <Step n={5}>{renderBold(m.metricModal.oneShot.step5)}</Step>
        </div>
      </Section>

      {!methodsOnly && (
        <Section title={m.metricModal.common.grade}>
          <GradeTable
            m={m}
            rows={[
              { grade: "exemplary", range: "80%+",   label: m.metricModal.oneShot.grade1 },
              { grade: "moderate",  range: "40~79%", label: m.metricModal.oneShot.grade2 },
              { grade: "warning",   range: "<40%",   label: m.metricModal.oneShot.grade3 },
            ]}
            currentGrade={grade}
          />
          <p className="text-xs text-slate-600 mt-2">{m.metricModal.oneShot.gradeFootnote}</p>
        </Section>
      )}
    </ModalShell>
  );
}

export function CostPerSessionModal({
  value,
  sessionsCount,
  totalCost,
  onClose,
  methodsOnly = false,
}: {
  value: number;
  sessionsCount: number;
  totalCost: number;
  onClose: () => void;
  methodsOnly?: boolean;
}) {
  const { m } = useMessages();
  const grade = costPerSessionGrade(value);
  const label = m.metricModal.costSession.label;
  const title = methodsOnly
    ? tmpl(m.metricModal.common.methodsTitle, { label, action: m.metricModal.common.howTo })
    : tmpl(m.metricModal.common.detailsTitle, { label });

  return (
    <ModalShell title={title} onClose={onClose}>
      {!methodsOnly && (
        <Section title={tmpl(m.metricModal.common.what, { label })}>
          <p className="text-slate-400 leading-relaxed text-xs">
            <Mono>claude</Mono> · <Mono>/exit</Mono> · <Mono>claude</Mono>{" "}
            {m.metricModal.costSession.def1}
          </p>
          <div className="bg-slate-800 rounded px-3 py-2 text-xs font-mono leading-relaxed">
            <span className="text-slate-400">{m.metricModal.costSession.formulaLine}</span>
            <br />
            <span className="text-slate-300">
              {renderBold(tmpl(m.metricModal.costSession.formulaVal, {
                totalCost: totalCost.toFixed(2),
                sessions: sessionsCount,
                value: value.toFixed(2),
              }))}
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed text-xs">{m.metricModal.costSession.def2}</p>
        </Section>
      )}

      <Section title={m.metricModal.common.howTo}>
        <p className="text-xs text-slate-500 mb-2">{renderBold(m.metricModal.costSession.methodsLead)}</p>
        <div className="space-y-2.5">
          <Step n={1}>{renderBold(m.metricModal.costSession.step1)}</Step>
          <Step n={2}>{renderBold(m.metricModal.costSession.step2)} (<Mono>/context</Mono>)</Step>
          <Step n={3}>{renderBold(m.metricModal.costSession.step3)}</Step>
          <Step n={4}>{renderBold(m.metricModal.costSession.step4)} (<Mono>/model haiku</Mono>)</Step>
          <Step n={5}>{renderBold(m.metricModal.costSession.step5)}</Step>
        </div>
      </Section>

      {!methodsOnly && (
        <Section title={m.metricModal.common.gradeForSonnet}>
          <GradeTable
            m={m}
            rows={[
              { grade: "exemplary", range: "<$25",    label: m.metricModal.costSession.grade1 },
              { grade: "moderate",  range: "$25~100", label: m.metricModal.costSession.grade2 },
              { grade: "warning",   range: "$100+",   label: m.metricModal.costSession.grade3 },
            ]}
            currentGrade={grade}
          />
          <p className="text-xs text-slate-600 mt-2">{m.metricModal.costSession.gradeFootnote}</p>
        </Section>
      )}
    </ModalShell>
  );
}

export function CostPerCallModal({
  value,
  totalCost,
  totalCalls,
  onClose,
  methodsOnly = false,
}: {
  value: number;
  totalCost: number;
  totalCalls: number;
  onClose: () => void;
  methodsOnly?: boolean;
}) {
  const { m } = useMessages();
  const label = m.metricModal.costCall.label;
  const title = methodsOnly
    ? tmpl(m.metricModal.common.methodsTitle, { label, action: m.metricModal.common.howTo })
    : tmpl(m.metricModal.common.detailsTitle, { label });

  return (
    <ModalShell title={title} onClose={onClose}>
      {!methodsOnly && (
        <Section title={tmpl(m.metricModal.common.what, { label })}>
          <p className="text-slate-400 leading-relaxed text-xs">{m.metricModal.costCall.def1}</p>
          <div className="bg-slate-800 rounded px-3 py-2 text-xs font-mono leading-relaxed">
            <span className="text-slate-400">{m.metricModal.costCall.formulaLine}</span>
            <br />
            <span className="text-slate-300">
              {renderBold(tmpl(m.metricModal.costCall.formulaVal, {
                totalCost: totalCost.toFixed(2),
                totalCalls: totalCalls.toLocaleString(),
                value: value.toFixed(3),
              }))}
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed text-xs">{m.metricModal.costCall.def2}</p>
        </Section>
      )}
      <Section title={m.metricModal.common.howTo}>
        <div className="space-y-2.5">
          <Step n={1}>{renderBold(m.metricModal.costCall.step1)}</Step>
          <Step n={2}>{renderBold(m.metricModal.costCall.step2)} (<Mono>/model haiku</Mono>)</Step>
          <Step n={3}>{renderBold(m.metricModal.costCall.step3)}</Step>
          <Step n={4}>{renderBold(m.metricModal.costCall.step4)}</Step>
          <Step n={5}>{renderBold(m.metricModal.costCall.step5)}</Step>
        </div>
      </Section>
      {!methodsOnly && (
        <Section title={m.metricModal.common.reference}>
          <p className="text-xs text-slate-500 leading-relaxed">
            {m.metricModal.costCall.referenceBody}
          </p>
        </Section>
      )}
    </ModalShell>
  );
}

export function TokenVolumeModal({
  level,
  avgDailyTokens,
  onClose,
}: {
  level: number;
  avgDailyTokens: number;
  onClose: () => void;
}) {
  const { m } = useMessages();
  const tokensFmt = avgDailyTokens >= 1_000_000
    ? `${(avgDailyTokens / 1_000_000).toFixed(1)}M`
    : `${(avgDailyTokens / 1_000).toFixed(1)}K`;
  const title = tmpl(m.metricModal.tokenVolume.titleTpl, { level, tokens: tokensFmt });
  const label = m.metricModal.tokenVolume.label;

  const rows = [
    { lvl: 10, range: "> 300M",   note: m.metricModal.tokenVolume.row10 },
    { lvl: 9,  range: "≤ 300M",   note: m.metricModal.tokenVolume.row9 },
    { lvl: 8,  range: "≤ 150M",   note: m.metricModal.tokenVolume.row8 },
    { lvl: 7,  range: "≤  80M",   note: m.metricModal.tokenVolume.row7 },
    { lvl: 6,  range: "≤  40M",   note: m.metricModal.tokenVolume.row6 },
    { lvl: 5,  range: "≤  25M",   note: m.metricModal.tokenVolume.row5 },
    { lvl: 4,  range: "≤  15M",   note: m.metricModal.tokenVolume.row4 },
    { lvl: 3,  range: "≤   8M",   note: m.metricModal.tokenVolume.row3 },
    { lvl: 2,  range: "≤   3M",   note: m.metricModal.tokenVolume.row2 },
    { lvl: 1,  range: "≤   1M",   note: m.metricModal.tokenVolume.row1 },
    { lvl: 0,  range: "0",        note: m.metricModal.tokenVolume.row0 },
  ];

  return (
    <ModalShell title={title} onClose={onClose}>
      <Section title={tmpl(m.metricModal.common.what, { label })}>
        <p className="text-slate-400 leading-relaxed text-xs">{renderBold(m.metricModal.tokenVolume.def1)}</p>
        <p className="text-slate-400 leading-relaxed text-xs">
          <strong className="text-slate-300">{m.metricModal.tokenVolume.def2Title}</strong> — {m.metricModal.tokenVolume.def2}
        </p>
      </Section>
      <Section title={m.metricModal.tokenVolume.gradesTitle}>
        <p className="text-xs text-slate-500 mb-2">{m.metricModal.tokenVolume.gradesLead}</p>
        <div className="space-y-0.5 text-xs font-mono">
          {rows.map((r) => (
            <div key={r.lvl} className={`flex gap-2 px-2 py-1 rounded ${r.lvl === level ? "bg-cyan-950/60 text-cyan-200 font-bold" : "text-slate-500"}`}>
              <span className="w-12 shrink-0">{r.lvl}/10</span>
              <span className="w-20 shrink-0">{r.range}</span>
              <span className="opacity-80">{r.note}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-2">{m.metricModal.tokenVolume.footnote}</p>
      </Section>
    </ModalShell>
  );
}

export function CallsPerSessionModal({
  value,
  callsTotal,
  sessionsCount,
  onClose,
  methodsOnly = false,
}: {
  value: number;
  callsTotal: number;
  sessionsCount: number;
  onClose: () => void;
  methodsOnly?: boolean;
}) {
  const { m } = useMessages();
  const label = m.metricModal.callsPerSession.label;
  const title = methodsOnly
    ? tmpl(m.metricModal.common.methodsTitle, { label, action: m.metricModal.common.howTo })
    : tmpl(m.metricModal.common.detailsTitle, { label });

  return (
    <ModalShell title={title} onClose={onClose}>
      {!methodsOnly && (
        <>
          <Section title={tmpl(m.metricModal.common.what, { label })}>
            <p className="text-slate-400 leading-relaxed text-xs">{renderBold(m.metricModal.callsPerSession.def1)}</p>
            <div className="bg-slate-800 rounded px-3 py-2 text-xs font-mono leading-relaxed">
              <span className="text-slate-400">{m.metricModal.callsPerSession.formulaLine}</span>
              <br />
              <span className="text-slate-300">
                {renderBold(tmpl(m.metricModal.callsPerSession.formulaVal, {
                  totalCalls: callsTotal.toLocaleString(),
                  sessions: sessionsCount,
                  value,
                }))}
              </span>
            </div>
          </Section>

          <Section title={m.metricModal.callsPerSession.goodDirTitle}>
            <p className="text-slate-400 leading-relaxed text-xs">{renderBold(m.metricModal.callsPerSession.goodDirLead)}</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-red-400 mb-1">{m.metricModal.callsPerSession.highBadTitle}</p>
                <ul className="space-y-0.5 text-xs text-slate-500 list-disc list-inside">
                  {m.metricModal.callsPerSession.highBadItems.map((it: string, i: number) => <li key={i}>{it}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-yellow-400 mb-1">{m.metricModal.callsPerSession.lowBadTitle}</p>
                <ul className="space-y-0.5 text-xs text-slate-500 list-disc list-inside">
                  {m.metricModal.callsPerSession.lowBadItems.map((it: string, i: number) => <li key={i}>{it}</li>)}
                </ul>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">{renderBold(m.metricModal.callsPerSession.goodRange)}</p>
          </Section>
        </>
      )}

      <Section title={m.metricModal.common.howTo}>
        <p className="text-xs text-slate-500 mb-2">{renderBold(m.metricModal.callsPerSession.methodsLead)}</p>
        <div className="space-y-2.5">
          {((): React.ReactNode[] => {
            const steps: React.ReactNode[] = [];
            if (value >= 100) steps.push(renderBold(m.metricModal.callsPerSession.stepHigh));
            if (value < 10)   steps.push(renderBold(m.metricModal.callsPerSession.stepLow));
            steps.push(renderBold(m.metricModal.callsPerSession.stepOneShot));
            steps.push(renderBold(m.metricModal.callsPerSession.stepClaudeMd));
            steps.push(renderBold(m.metricModal.callsPerSession.stepDeclare));
            return steps.map((content, i) => <Step key={i} n={i + 1}>{content}</Step>);
          })()}
        </div>
      </Section>

      {!methodsOnly && (
        <Section title={m.metricModal.common.reference}>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            {m.metricModal.callsPerSession.referenceBody}
          </p>
          <div className="mt-3 space-y-1 text-xs text-slate-600">
            <p className="font-semibold text-slate-500">{m.metricModal.callsPerSession.seeAlsoTitle}</p>
            <p>{m.metricModal.callsPerSession.seeAlso1}</p>
            <p>{m.metricModal.callsPerSession.seeAlso2}</p>
            <p>{m.metricModal.callsPerSession.seeAlso3}</p>
          </div>
        </Section>
      )}
    </ModalShell>
  );
}
