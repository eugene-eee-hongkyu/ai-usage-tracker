"use client";

export const dynamic = "force-dynamic";

// 첫 실행 마이그레이션 위저드 — Electron 이 .app 첫 실행 시 이 페이지로 BrowserWindow 로드.
// locale 은 ?locale=ko / en / ja / ... 쿼리스트링으로 받음 (Electron app.getLocale() 매핑).
// 누락/지원 안 함은 자동 en fallback.
//
// 동작:
//   1. /api/config/status 로 legacy / 기존 config 상태 조회
//   2. 사용자 선택 (Local only / Local + Company / Company only)
//   3. /api/config/save 로 ~/.usage-tracker/config.json 저장
//   4. /dashboard 로 이동

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getMessages, normalizeLocale } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";

type Choice = "local" | "local_company" | "company";

interface StatusResponse {
  hasConfig: boolean;
  legacy: {
    hasApiKey: boolean;
    apiKey: string | null;
    hasLaunchAgent: boolean;
  };
  companyUrl: string;
}

export default function WizardPage() {
  return (
    <Suspense fallback={null}>
      <WizardInner />
    </Suspense>
  );
}

function WizardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = normalizeLocale(searchParams.get("locale"));
  const m = getMessages(locale);

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [choice, setChoice] = useState<Choice>("local");
  const [phase, setPhase] = useState<"loading" | "form" | "saving" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    fetch("/api/config/status")
      .then((r) => r.json())
      .then((data: StatusResponse) => {
        setStatus(data);
        setChoice(data.legacy.hasApiKey ? "local_company" : "local");
        setPhase("form");
      })
      .catch((err) => {
        setErrorMsg((err as Error).message);
        setPhase("error");
      });
  }, []);

  async function save() {
    if (!status) return;
    setPhase("saving");

    const port =
      typeof window !== "undefined" ? window.location.port || "3737" : "3737";
    const destinations: Array<{ name: string; url: string; apiKey?: string }> = [];

    if (choice === "local" || choice === "local_company") {
      destinations.push({ name: "local", url: `http://localhost:${port}` });
    }
    if (choice === "company" || choice === "local_company") {
      const apiKey = status.legacy.apiKey ?? undefined;
      destinations.push({ name: "company", url: status.companyUrl, ...(apiKey && { apiKey }) });
    }

    try {
      const resp = await fetch("/api/config/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinations }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      setPhase("done");
      setTimeout(() => router.push(`/dashboard?locale=${locale}`), 800);
    } catch (err) {
      setErrorMsg((err as Error).message);
      setPhase("error");
    }
  }

  if (phase === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
        <p className="text-sm text-neutral-500">…</p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-red-400">{m.wizard.error}</h1>
          <p className="text-sm font-mono text-neutral-400 break-all">{errorMsg}</p>
          <button
            onClick={() => location.reload()}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded"
          >
            {m.wizard.actions.retry}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-2xl font-bold">{m.wizard.title}</h1>
          <LocaleSwitcher variant="wizard" />
        </div>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">{m.wizard.step1.heading}</h2>
          <p className="text-sm text-neutral-400">{m.wizard.step1.lead}</p>
          {status?.legacy.hasApiKey ? (
            <p className="text-sm text-emerald-400">✓ {m.wizard.step1.legacyFound}</p>
          ) : (
            <p className="text-sm text-neutral-500">{m.wizard.step1.legacyNotFound}</p>
          )}
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">{m.wizard.destinations.heading}</h2>
          <div className="space-y-2">
            <ChoiceRow
              checked={choice === "local"}
              onChange={() => setChoice("local")}
              label={m.wizard.destinations.localOnly}
            />
            {status?.legacy.hasApiKey && (
              <ChoiceRow
                checked={choice === "local_company"}
                onChange={() => setChoice("local_company")}
                label={m.wizard.destinations.localAndCompany}
              />
            )}
            {status?.legacy.hasApiKey && (
              <ChoiceRow
                checked={choice === "company"}
                onChange={() => setChoice("company")}
                label={m.wizard.destinations.companyOnly}
              />
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-3">{m.wizard.destinations.hint}</p>
        </section>

        <div className="mt-10 flex items-center gap-3">
          <button
            onClick={save}
            disabled={phase === "saving"}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded font-semibold"
          >
            {phase === "saving"
              ? m.wizard.saving
              : phase === "done"
                ? m.wizard.saved
                : m.wizard.actions.continue}
          </button>
        </div>
      </div>
    </main>
  );
}

function ChoiceRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 p-3 bg-neutral-900 border border-neutral-800 rounded cursor-pointer hover:bg-neutral-800/60">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-1 accent-indigo-500"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
