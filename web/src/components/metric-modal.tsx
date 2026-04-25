"use client";

import { useEffect } from "react";

type GradeRow = { grade: string; range: string; label: string };

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

function GradeTable({ rows, currentGrade }: { rows: GradeRow[]; currentGrade: string }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="text-slate-600">
          <th className="text-left py-1.5 w-10 font-normal">등급</th>
          <th className="text-left py-1.5 w-24 font-normal">범위</th>
          <th className="text-left py-1.5 font-normal">상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const cur = row.grade === currentGrade;
          return (
            <tr key={row.grade} className={cur ? "bg-indigo-950/60" : ""}>
              <td className={`py-1.5 pl-2 rounded-l font-bold ${cur ? "text-indigo-300" : "text-slate-500"}`}>
                {row.grade}
              </td>
              <td className={`py-1.5 ${cur ? "text-indigo-200" : "text-slate-400"}`}>{row.range}</td>
              <td className={`py-1.5 pr-2 rounded-r ${cur ? "text-indigo-200 font-medium" : "text-slate-500"}`}>
                {row.label}{cur && <span className="ml-1.5 text-indigo-400">← 현재</span>}
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

function cacheHitGrade(v: number) {
  if (v >= 96) return "S";
  if (v >= 90) return "A";
  if (v >= 80) return "B";
  if (v >= 60) return "C";
  return "D";
}

function costPerSessionGrade(v: number) {
  if (v < 10) return "S";
  if (v < 25) return "A";
  if (v < 50) return "B";
  if (v < 100) return "C";
  return "D";
}

export function CacheHitModal({ value, onClose }: { value: number; onClose: () => void }) {
  const grade = cacheHitGrade(value);

  return (
    <ModalShell title="Cache hit 상세" onClose={onClose}>
      <Section title="Cache hit이란">
        <p className="text-slate-400 leading-relaxed text-xs">
          Claude Code가 메시지를 보낼 때마다 시스템 프롬프트 + CLAUDE.md + 도구 정의 + 지금까지의 대화 전체를 매번 다시 전송합니다.
          평균 한 번에 5만~10만 토큰.
        </p>
        <p className="text-slate-400 leading-relaxed text-xs">
          이 중 대부분은 이전 메시지와 똑같은 부분(시스템 프롬프트, CLAUDE.md, 이전 대화).
          API에 &ldquo;이거 캐시해놓고 다음엔 꺼내 써&rdquo;라고 표시할 수 있고,{" "}
          <strong className="text-slate-300">꺼내 쓰는 가격이 정상가의 1/10</strong>.
        </p>
        <div className="bg-slate-800 rounded px-3 py-2 text-xs text-slate-300 font-mono leading-relaxed">
          Cache hit = 캐시 읽기 ÷ (캐시 읽기 + 캐시 쓰기 + 새 입력)
        </div>
        <p className="text-slate-400 leading-relaxed text-xs">
          현재 {value}%는 &ldquo;전체 입력의 {value}%를 1/10 가격으로 처리했다&rdquo;는 뜻.
          Claude Code 엔지니어가 말하길 정상 세션은 96% 정도 나오고, cache hit이 떨어지면 사고(SEV)로 본다고 합니다.{" "}
          {value >= 90 && <strong className="text-slate-300">{value}%는 매우 좋은 상태입니다.</strong>}{" "}
          <Ref href="https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code">출처</Ref>
        </p>
      </Section>

      <Section title="올리는 방법">
        <p className="text-xs text-slate-500 mb-2">
          캐시는 메시지 시작 부분을 통째로 비교합니다. 1바이트라도 다르면 캐시 무효화 → 풀 가격.{" "}
          <strong className="text-slate-400">시작 부분을 안정적으로 유지</strong>하는 게 전부.
        </p>
        <div className="space-y-2.5">
          <Step n={1}>
            <strong className="text-slate-300">CLAUDE.md 안정화</strong> — 짧게 + 자주 안 바꾸기.
            자주 바뀌는 내용(이번 스프린트)은 맨 아래로, 안 바뀌는 내용(테크 스택)은 맨 위로.
          </Step>
          <Step n={2}>
            <strong className="text-slate-300">한 세션 = 한 작업</strong> — 분리된 짧은 세션 3개가
            한 세션에서 이리저리 옮겨다니는 50턴보다 총 비용이 적음.
          </Step>
          <Step n={3}>
            <strong className="text-slate-300">5분 이상 쉬지 말기</strong> — 캐시 TTL이 5분.
            화장실 다녀오면 캐시 만료 → 첫 메시지 비쌈.
          </Step>
          <Step n={4}>
            <strong className="text-slate-300">MCP 도구 자주 추가/제거 안 하기</strong> — 도구 정의가 캐시 앞쪽에 있어서
            바뀌면 그 뒤 전부 무효화.
          </Step>
          <Step n={5}>
            <strong className="text-slate-300">세션 중 모델 바꾸지 말기</strong> — Sonnet ↔ Opus 전환은 캐시 깸.
          </Step>
        </div>
      </Section>

      <Section title="등급">
        <GradeTable
          rows={[
            { grade: "S", range: "96%+", label: "Claude Code 본사 내부 기준" },
            { grade: "A", range: "90~95%", label: "좋음" },
            { grade: "B", range: "80~90%", label: "보통" },
            { grade: "C", range: "60~80%", label: "개선 필요 — CLAUDE.md 비대 의심" },
            { grade: "D", range: "60% 미만", label: "본사 기준 사고(SEV) 수준" },
          ]}
          currentGrade={grade}
        />
        <p className="text-xs text-slate-600 mt-2">
          <Ref href="https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code">
            Claude Code Camp — How prompt caching actually works
          </Ref>
        </p>
      </Section>
    </ModalShell>
  );
}

export function CostPerSessionModal({
  value,
  sessionsCount,
  totalCost,
  onClose,
}: {
  value: number;
  sessionsCount: number;
  totalCost: number;
  onClose: () => void;
}) {
  const grade = costPerSessionGrade(value);

  return (
    <ModalShell title="세션당 평균 비용 상세" onClose={onClose}>
      <Section title="세션당 평균 비용이란">
        <p className="text-slate-400 leading-relaxed text-xs">
          <Mono>claude</Mono> 명령으로 시작하고 <Mono>/exit</Mono> 또는 터미널을 닫으면 세션 종료.
          새 <Mono>claude</Mono> 명령은 새 세션.
        </p>
        <div className="bg-slate-800 rounded px-3 py-2 text-xs font-mono leading-relaxed">
          <span className="text-slate-400">세션당 평균 비용 = 총 비용 ÷ 세션 수</span>
          <br />
          <span className="text-slate-300">
            ${totalCost.toFixed(2)} ÷ {sessionsCount} ={" "}
            <strong className="text-indigo-300">세션당 ${value.toFixed(2)}</strong>
          </span>
        </div>
        <p className="text-slate-400 leading-relaxed text-xs">
          토큰 총합이나 총 비용은 &ldquo;많이 썼다&rdquo;는 뜻이지 &ldquo;잘 썼다&rdquo;는 뜻이 아닙니다.
          세션당 비용은 <strong className="text-slate-300">&ldquo;한 작업 단위 끝내는 데 평균 얼마 들었나&rdquo;</strong>를 보여주는
          가장 직접적인 지표. 시간이 지나면서 이 수치가 줄면 Claude를 더 잘 쓰게 된 것.
        </p>
      </Section>

      <Section title="줄이는 방법">
        <p className="text-xs text-slate-500 mb-2">
          한 세션이 길어질수록 매 메시지마다 재전송되는 대화 히스토리가 누적됩니다.{" "}
          <strong className="text-slate-400">세션을 적정 단위로 끊는 게 전부.</strong>
        </p>
        <div className="space-y-2.5">
          <Step n={1}>
            <strong className="text-slate-300">작업 단위로 세션 끊기</strong> — worklog 저장·커밋·PR 같은
            마무리 시점이 새 세션 신호. 다음 작업이 이전 컨텍스트 필요 없으면 무조건 새 세션.
          </Step>
          <Step n={2}>
            <strong className="text-slate-300">컨텍스트 70% 넘으면 마무리 모드</strong> — auto-compact 발동되면
            compact 작업 자체가 큰 비용. 95% 도달 전에 작업 마무리 + 새 세션 시작.
          </Step>
          <Step n={3}>
            <strong className="text-slate-300">CLAUDE.md 다이어트</strong> — 5KB CLAUDE.md면 매 메시지마다 5천 토큰.
            100 메시지 세션이면 500K 토큰이 CLAUDE.md만으로 발생. 핵심만 남기기.
          </Step>
          <Step n={4}>
            <strong className="text-slate-300">단순 작업은 Haiku로</strong> — 파일 찾기·간단 명령·짧은 읽기는
            Haiku가 1/10 가격. <Mono>/model haiku</Mono>로 수동 지정.
          </Step>
          <Step n={5}>
            <strong className="text-slate-300">끊었다 5분 안에 같은 작업 재개하지 않기</strong> — 5분 안이면 캐시
            살아있어서 기존 세션 이어가는 게 쌈. 끊었다 5분 안에 재개하면 두 번 캐시 만들기.
          </Step>
        </div>
      </Section>

      <Section title="등급 (Sonnet 기준)">
        <GradeTable
          rows={[
            { grade: "S", range: "$10 미만", label: "짧은 작업 단위로 잘 분리됨. 본보기 패턴" },
            { grade: "A", range: "$10~25", label: "적당한 규모 작업. 정상" },
            { grade: "B", range: "$25~50", label: "큰 작업 또는 한 세션에 여러 작업 섞임" },
            { grade: "C", range: "$50~100", label: "세션이 너무 큼. 분리 필요" },
            { grade: "D", range: "$100+", label: "auto-compact 트리거되는 거대 세션. 비효율" },
          ]}
          currentGrade={grade}
        />
        <p className="text-xs text-slate-600 mt-2">Opus는 약 5배로 환산.</p>
      </Section>
    </ModalShell>
  );
}
