"use client";

import { useEffect } from "react";

type GradeLevel = "탁월" | "양호" | "보통" | "부족" | "경고";
type GradeRow = { grade: GradeLevel; range: string; label: string };

const GRADE_ROW_COLORS: Record<GradeLevel, { bg: string; gradeText: string; contentText: string }> = {
  "탁월": { bg: "bg-emerald-950/60", gradeText: "text-emerald-300", contentText: "text-emerald-200" },
  "양호": { bg: "bg-green-950/60",   gradeText: "text-green-300",   contentText: "text-green-200" },
  "보통": { bg: "bg-yellow-950/60",  gradeText: "text-yellow-300",  contentText: "text-yellow-200" },
  "부족": { bg: "bg-orange-950/60",  gradeText: "text-orange-300",  contentText: "text-orange-200" },
  "경고": { bg: "bg-red-950/60",     gradeText: "text-red-300",     contentText: "text-red-200" },
};

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

function GradeTable({ rows, currentGrade }: { rows: GradeRow[]; currentGrade: GradeLevel }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="text-slate-600">
          <th className="text-left py-1.5 w-20 font-normal">등급</th>
          <th className="text-left py-1.5 w-28 font-normal">범위</th>
          <th className="text-left py-1.5 font-normal">설명</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const cur = row.grade === currentGrade;
          const style = GRADE_ROW_COLORS[row.grade];
          return (
            <tr key={row.grade} className={cur ? style.bg : ""}>
              <td className={`py-1.5 pl-2 rounded-l font-bold ${cur ? style.gradeText : "text-slate-500"}`}>
                {row.grade}
              </td>
              <td className={`py-1.5 ${cur ? style.contentText : "text-slate-400"}`}>{row.range}</td>
              <td className={`py-1.5 pr-2 rounded-r ${cur ? `${style.contentText} font-medium` : "text-slate-500"}`}>
                {row.label}{cur && <span className={`ml-1.5 ${style.gradeText}`}>← 현재</span>}
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
  if (v >= 96) return "탁월";
  if (v >= 90) return "양호";
  if (v >= 80) return "보통";
  if (v >= 60) return "부족";
  return "경고";
}

function oneShotGrade(v: number): GradeLevel {
  if (v >= 90) return "탁월";
  if (v >= 80) return "양호";
  if (v >= 70) return "보통";
  if (v >= 60) return "부족";
  return "경고";
}

function costPerSessionGrade(v: number): GradeLevel {
  if (v < 10) return "탁월";
  if (v < 25) return "양호";
  if (v < 50) return "보통";
  if (v < 100) return "부족";
  return "경고";
}

function callsPerSessionGrade(v: number): GradeLevel {
  if (v >= 30 && v <= 60) return "탁월";
  if ((v >= 20 && v < 30) || (v > 60 && v <= 80)) return "양호";
  if ((v >= 10 && v < 20) || (v > 80 && v <= 120)) return "보통";
  if ((v >= 5 && v < 10) || (v > 120 && v <= 200)) return "부족";
  return "경고";
}

export function CacheHitModal({ value, onClose, methodsOnly = false }: { value: number; onClose: () => void; methodsOnly?: boolean }) {
  const grade = cacheHitGrade(value);

  return (
    <ModalShell title={methodsOnly ? "Cache hit 올리는 방법" : "Cache hit 상세"} onClose={onClose}>
      {!methodsOnly && (
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
      )}

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

      {!methodsOnly && (
        <Section title="등급">
          <GradeTable
            rows={[
              { grade: "탁월", range: "96%+",     label: "Claude Code 본사 내부 기준" },
              { grade: "양호", range: "90~95%",   label: "좋은 상태" },
              { grade: "보통", range: "80~89%",   label: "일반적인 수준" },
              { grade: "부족", range: "60~79%",   label: "CLAUDE.md 비대 의심" },
              { grade: "경고", range: "60% 미만", label: "본사 기준 사고(SEV) 수준" },
            ]}
            currentGrade={grade}
          />
          <p className="text-xs text-slate-600 mt-2">
            <Ref href="https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code">
              Claude Code Camp — How prompt caching actually works
            </Ref>
          </p>
        </Section>
      )}
    </ModalShell>
  );
}

export function OneShotRateModal({ value, onClose, methodsOnly = false }: { value: number; onClose: () => void; methodsOnly?: boolean }) {
  const grade = oneShotGrade(value);

  return (
    <ModalShell title={methodsOnly ? "One-shot rate 올리는 방법" : "One-shot rate 상세"} onClose={onClose}>
      {!methodsOnly && (
        <Section title="One-shot rate란">
          <p className="text-slate-400 leading-relaxed text-xs">
            Claude Code가 코드를 고치거나 새로 쓸 때 사용하는 도구가 있습니다 (Edit, Write, MultiEdit).
            이 도구가 호출되면 결과는 둘 중 하나: <strong className="text-slate-300">첫 시도에 성공</strong> 또는{" "}
            <strong className="text-slate-300">실패해서 재시도</strong>.
          </p>
          <p className="text-slate-400 leading-relaxed text-xs">
            실패 사례: 파일에서 찾으려는 텍스트가 미세하게 달라서 못 찾음, 들여쓰기 안 맞음, 이미 다른 곳을 수정해서
            충돌남, 잘못된 문법으로 새 파일 작성. 실패하면 Claude가 다시 읽고 다시 시도 →{" "}
            <strong className="text-slate-300">토큰 추가 소비 + 시간 추가 소비</strong>.
          </p>
          <div className="bg-slate-800 rounded px-3 py-2 text-xs text-slate-300 font-mono leading-relaxed">
            One-shot rate = 첫 시도 성공 edit 수 ÷ 전체 edit 호출 수
          </div>
          <p className="text-slate-400 leading-relaxed text-xs">
            cache hit이나 비용은 &ldquo;얼마나 들었나&rdquo;를 보여주지만, one-shot rate는{" "}
            <strong className="text-slate-300">&ldquo;Claude가 얼마나 정확하게 작성했나&rdquo;</strong>를 보여줍니다.
            retry 루프에 빠지면 토큰만 태우고 결과 안 나옴 — 보고된 케이스로 90K 토큰을 retry로 태우는 세션이 있을 정도.
            <strong className="text-slate-300"> AI 활용 능력의 가장 직접적인 지표.</strong>
          </p>
        </Section>
      )}

      <Section title="올리는 방법">
        <p className="text-xs text-slate-500 mb-2">
          Claude가 한 번에 정확하게 작성하려면{" "}
          <strong className="text-slate-400">충분한 컨텍스트 + 명확한 지시</strong>가 필요. 두 축 다 사용자가 결정.
        </p>
        <div className="space-y-2.5">
          <Step n={1}>
            <strong className="text-slate-300">수정 전에 충분히 읽게 하기</strong> — &ldquo;이 함수 리팩토링해줘&rdquo;보다
            &ldquo;이 파일 다 읽고 전체 구조 본 다음에 함수 X를 Y 패턴으로 리팩토링해줘&rdquo;가 정확.
            Claude가 추측 시도하면 retry 늘어남.
          </Step>
          <Step n={2}>
            <strong className="text-slate-300">모호한 지시 제거</strong> — &ldquo;이거 좀 깔끔하게&rdquo; 같은 건 Claude가 추측.
            &ldquo;이 함수의 try-catch를 Result 타입 리턴으로 바꿔줘&rdquo; 같은 구체적 지시는 한 번에 됨.
          </Step>
          <Step n={3}>
            <strong className="text-slate-300">큰 변경은 단계 분리</strong> — &ldquo;전체 파일 새로 짜줘&rdquo;보다
            &ldquo;1단계: 인터페이스만 정의 / 2단계: 구현 / 3단계: 테스트&rdquo;. 각 단계 one-shot rate ↑.
          </Step>
          <Step n={4}>
            <strong className="text-slate-300">CLAUDE.md에 코딩 컨벤션 명시</strong> — 들여쓰기·네이밍·import 순서.
            Claude가 추측 안 하고 명시된 거 따름 → 첫 시도 성공률 ↑.
          </Step>
          <Step n={5}>
            <strong className="text-slate-300">외부 변경 후엔 재읽기</strong> — git pull 했거나 다른 사람이 같은 파일
            만졌다면 &ldquo;최신 파일 다시 읽고 작업해줘&rdquo;. 안 하면 옛날 컨텍스트로 작성 → 충돌 → retry.
          </Step>
        </div>
      </Section>

      {!methodsOnly && (
        <Section title="등급">
          <GradeTable
            rows={[
              { grade: "탁월", range: "90%+",     label: "명확한 지시 + 좋은 컨텍스트. 본보기 패턴" },
              { grade: "양호", range: "80~89%",   label: "좋은 상태" },
              { grade: "보통", range: "70~79%",   label: "지시 명확도 점검 필요" },
              { grade: "부족", range: "60~69%",   label: "자주 retry 발생. 컨텍스트 부족 가능성" },
              { grade: "경고", range: "60% 미만", label: "비효율 패턴. 토큰 낭비가 큼" },
            ]}
            currentGrade={grade}
          />
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
  const grade = costPerSessionGrade(value);

  return (
    <ModalShell title={methodsOnly ? "세션당 비용 줄이는 방법" : "세션당 비용 상세"} onClose={onClose}>
      {!methodsOnly && (
        <Section title="세션당 비용이란">
          <p className="text-slate-400 leading-relaxed text-xs">
            <Mono>claude</Mono> 명령으로 시작하고 <Mono>/exit</Mono> 또는 터미널을 닫으면 세션 종료.
            새 <Mono>claude</Mono> 명령은 새 세션.
          </p>
          <div className="bg-slate-800 rounded px-3 py-2 text-xs font-mono leading-relaxed">
            <span className="text-slate-400">세션당 비용 = 총 비용 ÷ 세션 수</span>
            <br />
            <span className="text-slate-300">
              ${totalCost.toFixed(2)} ÷ {sessionsCount} ={" "}
              <strong className="text-indigo-300">세션당 ${value.toFixed(2)}</strong>
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed text-xs">
            토큰 총합이나 총 비용은 &ldquo;많이 썼다&rdquo;는 뜻이지 &ldquo;잘 썼다&rdquo;는 뜻이 아닙니다.
            세션당 비용은{" "}
            <strong className="text-slate-300">&ldquo;한 작업 단위 끝내는 데 평균 얼마 들었나&rdquo;</strong>를 보여주는
            가장 직접적인 지표. 시간이 지나면서 이 수치가 줄면 Claude를 더 잘 쓰게 된 것.
          </p>
        </Section>
      )}

      <Section title="줄이는 방법">
        <p className="text-xs text-slate-500 mb-2">
          한 세션이 길어질수록 매 메시지마다 재전송되는 대화 히스토리가 누적됩니다.{" "}
          <strong className="text-slate-400">세션을 적정 단위로 끊는 게 전부.</strong>
        </p>
        <div className="space-y-2.5">
          <Step n={1}>
            <strong className="text-slate-300">작업 단위로 세션 끊기</strong> — worklog 저장·커밋·PR 같은
            마무리 시점이 새 세션 신호. 다음 작업이 이전 컨텍스트 필요 없으면 무조건 새 세션.
            12 세션/주가 30~40 세션/주가 되는 게 정상.
          </Step>
          <Step n={2}>
            <strong className="text-slate-300">컨텍스트 70% 넘으면 마무리 모드</strong> — 95% 도달해
            auto-compact 발동되면 compact 작업 자체가 큰 비용. compact 트리거 전에 작업 마무리 + 새 세션.
            <Mono>/context</Mono> 명령으로 수시 체크.
          </Step>
          <Step n={3}>
            <strong className="text-slate-300">CLAUDE.md 다이어트</strong> — 5KB CLAUDE.md면 매 메시지마다 5천 토큰.
            100 메시지 세션이면 500K 토큰이 CLAUDE.md만으로 발생. 핵심만 남기기.
          </Step>
          <Step n={4}>
            <strong className="text-slate-300">단순 작업은 Haiku로</strong> — 파일 찾기·간단 명령·짧은 읽기는
            Haiku가 1/10 가격. Claude Code가 자동 선택은 안 해서 <Mono>/model haiku</Mono>로 수동 지정.
          </Step>
          <Step n={5}>
            <strong className="text-slate-300">세션 종료 후 5분 안에 같은 작업 재개하지 않기</strong> — 5분 안이면
            캐시 살아있어서 기존 세션 이어가는 게 쌈. 끊었다 5분 안에 재개하면 두 번 캐시 만들기.
          </Step>
        </div>
      </Section>

      {!methodsOnly && (
        <Section title="등급 (Sonnet 기준)">
          <GradeTable
            rows={[
              { grade: "탁월", range: "$10 미만",  label: "짧은 작업 단위로 잘 분리됨. 본보기 패턴" },
              { grade: "양호", range: "$10~25",    label: "적당한 규모 작업. 정상" },
              { grade: "보통", range: "$25~50",    label: "큰 작업 또는 여러 작업 혼재" },
              { grade: "부족", range: "$50~100",   label: "세션이 너무 큼. 분리 필요" },
              { grade: "경고", range: "$100+",     label: "auto-compact 트리거되는 거대 세션. 비효율" },
            ]}
            currentGrade={grade}
          />
          <p className="text-xs text-slate-600 mt-2">Opus는 약 5배로 환산.</p>
        </Section>
      )}
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
  const grade = callsPerSessionGrade(value);

  return (
    <ModalShell title={methodsOnly ? "Calls per session 최적화 방법" : "Calls per session 상세"} onClose={onClose}>
      {!methodsOnly && (
        <>
          <Section title="Calls per session이란">
            <p className="text-slate-400 leading-relaxed text-xs">
              한 세션 안에서 Claude API를 몇 번 호출했나. 사용자가 메시지 한 번 보내면 Claude가 도구 여러 개
              부르면서 여러 번 API 호출함.{" "}
              <strong className="text-slate-300">한 세션의 turn 수 또는 도구 호출 횟수</strong>를 의미.
            </p>
            <div className="bg-slate-800 rounded px-3 py-2 text-xs font-mono leading-relaxed">
              <span className="text-slate-400">Calls per session = 총 calls ÷ 세션 수</span>
              <br />
              <span className="text-slate-300">
                {callsTotal.toLocaleString()} ÷ {sessionsCount} ={" "}
                <strong className="text-indigo-300">세션당 {value}회</strong>
              </span>
            </div>
          </Section>

          <Section title="좋은 방향이 어디인가 — 솔직히 말하면 양면성 있음">
            <p className="text-slate-400 leading-relaxed text-xs">
              이 지표는 cache hit이나 one-shot rate처럼 &ldquo;높을수록 좋다&rdquo; 또는 &ldquo;낮을수록 좋다&rdquo;가
              명확하지 않습니다. <strong className="text-slate-300">너무 높아도 안 좋고 너무 낮아도 안 좋음.</strong>{" "}
              헷갈리는 게 정상.
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-red-400 mb-1">높을수록 안 좋은 경우</p>
                <ul className="space-y-0.5 text-xs text-slate-500 list-disc list-inside">
                  <li>retry 루프에 빠짐 (one-shot rate 낮음과 동반)</li>
                  <li>Claude가 컨텍스트 부족해서 같은 파일 5번 읽음</li>
                  <li>한 세션에 여러 작업 섞여서 길게 끔</li>
                  <li>사용자가 명확한 지시 안 줘서 Claude가 헤맴</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-yellow-400 mb-1">낮을수록 안 좋은 경우</p>
                <ul className="space-y-0.5 text-xs text-slate-500 list-disc list-inside">
                  <li>Claude를 거의 안 쓰고 직접 작성 (도구로서 활용 안 함)</li>
                  <li>단순한 한 번 질문하고 끝 (자동화 가치 못 살림)</li>
                  <li>너무 잘게 세션 쪼개서 매번 컨텍스트 새로 만듦 (캐시 효율 ↓)</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <strong className="text-slate-400">적정 범위: 세션당 30~80 calls.</strong> 이 안에 들면 OK.
            </p>
          </Section>
        </>
      )}

      <Section title="좋게 하는 방법">
        <p className="text-xs text-slate-500 mb-2">
          calls per session 자체를 직접 조정하지 말고,{" "}
          <strong className="text-slate-400">세션이 한 작업 단위에 정확히 들어맞도록</strong> 만들면
          자연스럽게 적정 범위에 들어감.
        </p>
        <div className="space-y-2.5">
          {((): React.ReactNode[] => {
            const steps: React.ReactNode[] = [];
            if (value >= 100) steps.push(
              <><strong className="text-slate-300">너무 높다면 (100+ calls)</strong> — 세션이 너무 김.
              cost per session 대책 그대로 적용 — 작업 단위 끊기, 컨텍스트 70% 넘으면 마무리,
              한 세션 = 한 작업 원칙.</>
            );
            if (value < 10) steps.push(
              <><strong className="text-slate-300">너무 낮다면 (10 미만 calls)</strong> — Claude를 충분히 활용 못 하고 있음.
              &ldquo;이 부분 직접 작성해&rdquo; 대신 &ldquo;이 패턴으로 리팩토링해줘&rdquo;로 작업 위임 전환.</>
            );
            steps.push(
              <><strong className="text-slate-300">calls 적정인데 one-shot rate 낮다면</strong> — calls 수는 정상인데
              retry 비율이 높은 것. one-shot rate 올리는 방법 적용 (충분한 컨텍스트 + 명확한 지시).</>
            );
            steps.push(
              <><strong className="text-slate-300">CLAUDE.md에 작업 패턴 박기</strong> — &ldquo;Read 먼저 후 Edit&rdquo;,
              &ldquo;테스트 자동 실행&rdquo; 같은 룰을 CLAUDE.md에 명시. Claude가 같은 패턴 반복하면 calls 수가 안정됨.</>
            );
            steps.push(
              <><strong className="text-slate-300">세션 시작 시 작업 범위 선언</strong> — &ldquo;오늘은 X 기능만 구현. 끝나면 종료&rdquo;
              식으로 시작하면 Claude가 그 범위 안에서 작업. 무한 늘어지는 거 방지.</>
            );
            return steps.map((content, i) => <Step key={i} n={i + 1}>{content}</Step>);
          })()}
        </div>
      </Section>

      {!methodsOnly && (
        <Section title="등급">
          <GradeTable
            rows={[
              { grade: "탁월", range: "30~60",            label: "세션이 한 작업 단위에 정확히 매칭. 이상적" },
              { grade: "양호", range: "20~30 또는 60~80",  label: "약간 짧거나 약간 김" },
              { grade: "보통", range: "10~20 또는 80~120", label: "짧으면 활용 부족, 길면 분리 검토" },
              { grade: "부족", range: "5~10 또는 120~200", label: "너무 짧거나 너무 김. one-shot rate 같이 점검" },
              { grade: "경고", range: "5 미만 또는 200+",  label: "비정상. 활용 부족 또는 retry 루프 의심" },
            ]}
            currentGrade={grade}
          />
          <div className="mt-3 space-y-1 text-xs text-slate-600">
            <p className="font-semibold text-slate-500">같이 봐야 하는 지표</p>
            <p>• one-shot rate 낮으면서 calls 높음 → retry 루프. 가장 나쁜 신호</p>
            <p>• one-shot rate 정상인데 calls 높음 → 큰 작업. 분리 검토</p>
            <p>• calls 낮으면서 cost per session 높음 → 한 번에 너무 많이 처리. 컨텍스트 부담</p>
          </div>
        </Section>
      )}
    </ModalShell>
  );
}
