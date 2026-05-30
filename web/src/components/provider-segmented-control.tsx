"use client";

// dashboard / team / ranking 공용 — provider segmented control + disabled chip dialog.
// 위계상 (어떤 AI > 어디서 > 언제) 화면 최상단. 데이터 없는 chip 은 disabled +
// 클릭 시 "X 쓰면 자동 잡힙니다" dialog. dashboard 의 device-scope 분기 (옛 CLI)
// 는 codexNeedsCliUpdate=true 로 prop 전달.

import { useEffect, useState } from "react";

export type ProviderKey = "claude" | "codex";

export function ProviderSegmentedControl({
  value,
  onChange,
  hasClaudeData,
  hasCodexData,
  codexNeedsCliUpdate = false,
  testIdPrefix = "provider",
}: {
  value: ProviderKey;
  onChange: (v: ProviderKey) => void;
  hasClaudeData: boolean;
  hasCodexData: boolean;
  // dashboard 전용 — 선택 device 의 CLI 가 < 0.3.0 이면 Codex disabled 사유가
  // "데이터 없음" 이 아니라 "CLI 업데이트 필요". dialog 안내 문구 분기.
  codexNeedsCliUpdate?: boolean;
  testIdPrefix?: string;
}) {
  const [dialog, setDialog] = useState<ProviderKey | null>(null);

  const items: Array<{ key: ProviderKey; label: string; hasData: boolean }> = [
    { key: "claude", label: "Claude Code", hasData: hasClaudeData },
    { key: "codex", label: "Codex", hasData: hasCodexData },
  ];

  return (
    <>
      <div className="flex gap-2 items-center">
        <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider">provider</span>
        <div className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 p-0.5">
          {items.map((it) => {
            const selected = value === it.key;
            const disabled = !it.hasData;
            return (
              <button
                key={it.key}
                data-testid={`${testIdPrefix}-${it.key}`}
                onClick={() => {
                  if (disabled) setDialog(it.key);
                  else onChange(it.key);
                }}
                className={`text-xs font-mono rounded px-3 py-1 transition-colors ${
                  selected && !disabled
                    ? "bg-indigo-600 text-white"
                    : disabled
                      ? "text-neutral-600 hover:text-neutral-400 cursor-help"
                      : "text-neutral-300 hover:text-neutral-100"
                }`}
              >{it.label}</button>
            );
          })}
        </div>
      </div>
      {dialog && (
        <ProviderDisabledDialog
          provider={dialog}
          codexNeedsCliUpdate={codexNeedsCliUpdate}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

function ProviderDisabledDialog({
  provider,
  codexNeedsCliUpdate,
  onClose,
}: {
  provider: ProviderKey;
  codexNeedsCliUpdate: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isClaude = provider === "claude";
  const title = isClaude ? "Claude Code 사용 기록 없음" : "Codex 사용 기록 없음";
  const showCliUpdate = provider === "codex" && codexNeedsCliUpdate;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
      data-testid={`provider-disabled-dialog-${provider}`}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md my-16 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800 transition-colors"
          >×</button>
        </div>
        <div className="px-5 py-5 space-y-3 text-sm text-slate-300 leading-relaxed">
          {isClaude ? (
            <>
              <p>아직 <span className="text-cyan-400 font-mono">Claude Code</span> 사용 기록이 없습니다.</p>
              <p className="text-slate-400">
                평소처럼 Claude Code 를 쓰시면 세션 종료마다 자동으로 사용량이 수집되어 여기에 표시됩니다.
              </p>
            </>
          ) : showCliUpdate ? (
            <>
              <p>아직 <span className="text-cyan-400 font-mono">Codex</span> 사용 기록이 없습니다.</p>
              <p className="text-slate-400">
                현재 설치된 ai-usage-tracker CLI 버전은 Codex 사용량을 분리 집계하지 않습니다. CLI 를 최신 버전 (<span className="font-mono text-cyan-400">0.3.0+</span>) 으로 업데이트하면 Codex 사용량도 자동으로 잡힙니다.
              </p>
            </>
          ) : (
            <>
              <p>아직 <span className="text-cyan-400 font-mono">Codex</span> 사용 기록이 없습니다.</p>
              <p className="text-slate-400">
                Codex CLI 를 쓰시면 세션 종료마다 자동으로 사용량이 수집되어 여기에 표시됩니다. 별도 설정은 필요 없습니다.
              </p>
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs font-mono bg-indigo-600 hover:bg-indigo-500 text-white rounded px-4 py-1.5 transition-colors"
          >확인</button>
        </div>
      </div>
    </div>
  );
}
