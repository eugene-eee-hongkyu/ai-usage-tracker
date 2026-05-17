"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalMode } from "@/lib/use-local-mode";
import { useMessages } from "@/lib/use-i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";

function tmpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

const TIMEZONE_LIST: { label: string; value: string }[] = [
  { label: "SGT — Singapore (UTC+8)", value: "Asia/Singapore" },
  { label: "KST — Korea (UTC+9)", value: "Asia/Seoul" },
  { label: "JST — Japan (UTC+9)", value: "Asia/Tokyo" },
  { label: "HKT — Hong Kong (UTC+8)", value: "Asia/Hong_Kong" },
  { label: "CST — China (UTC+8)", value: "Asia/Shanghai" },
  { label: "IST — India (UTC+5:30)", value: "Asia/Kolkata" },
  { label: "GMT/BST — UK", value: "Europe/London" },
  { label: "CET — Central Europe", value: "Europe/Paris" },
  { label: "EST/EDT — US Eastern", value: "America/New_York" },
  { label: "CST/CDT — US Central", value: "America/Chicago" },
  { label: "PST/PDT — US Pacific", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
];

type Step = { label: string; done: boolean };

export default function SetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLocalMode = useLocalMode();
  const { m } = useMessages();
  const [steps, setSteps] = useState<Step[]>([
    { label: m.setupPage.stepHook, done: false },
    { label: m.setupPage.stepFirstSession, done: false },
  ]);
  const [copied, setCopied] = useState(false);
  const [timezone, setTimezone] = useState<string>("");
  const [tzSaved, setTzSaved] = useState(false);
  const [os, setOs] = useState<"mac" | "windows" | "other">("other");
  const [fetchError, setFetchError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) setOs("mac");
    else if (ua.includes("win")) setOs("windows");
  }, []);

  useEffect(() => {
    if (isLocalMode === null || isLocalMode) return;
    if (status === "unauthenticated") router.push("/login");
  }, [status, router, isLocalMode]);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(detected);
  }, []);

  const saveTz = async (tz: string) => {
    setTimezone(tz);
    setTzSaved(false);
    await fetch("/api/user/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    });
    setTzSaved(true);
  };

  useEffect(() => {
    if (!session) return;
    setFetchError(false);

    const poll = async () => {
      try {
        const res = await fetch("/api/setup/status");
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setFetchError(false);
        if (data.steps) setSteps([
          { label: m.setupPage.stepHook, done: !!data.steps.hook_registered },
          { label: m.setupPage.stepFirstSession, done: !!data.steps.first_session },
        ]);
      } catch {
        setFetchError(true);
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [session, reloadKey, m]);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://ai-usage-tracker-web-psi.vercel.app";
  const npxCmd = `npx --yes --ignore-cache github:${process.env.NEXT_PUBLIC_GITHUB_ORG ?? "eugene-eee-hongkyu"}/ai-usage-tracker init`;
  const installCmd =
    os === "windows"
      ? `irm ${origin}/install.ps1 | iex`
      : os === "mac"
        ? `curl -fsSL ${origin}/install.sh | bash`
        : `curl -fsSL ${origin}/install.sh | bash`;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === "loading") return null;

  const allDone = steps.every((s) => s.done);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-12 relative">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher variant="nav" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-100">
          {tmpl(m.setupPage.greeting, { name: session?.user?.name?.split(" ")[0] ?? "" })}
        </h1>
        <p className="text-slate-400 mt-2">{m.setupPage.sub}</p>
      </div>

      {fetchError && (
        <div data-testid="setup-fetch-error" className="w-full max-w-md bg-red-950 border border-red-800 rounded-xl p-4 space-y-2">
          <p className="text-red-300 text-sm font-semibold">{m.setupPage.fetchErrorTitle}</p>
          <p className="text-red-400 text-xs">{m.setupPage.fetchErrorBody}</p>
          <button
            data-testid="setup-retry"
            onClick={() => setReloadKey((k) => k + 1)}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
          >
            {m.setupPage.fetchRetry}
          </button>
        </div>
      )}


      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
        <div>
          <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">{m.setupPage.tzHeader}</p>
          <p className="text-sm text-slate-400 mt-1">{m.setupPage.tzLead}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            data-testid="setup-tz-select"
            value={timezone}
            onChange={(e) => saveTz(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-600 text-slate-100 text-sm rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-indigo-500"
          >
            {timezone && !TIMEZONE_LIST.find((t) => t.value === timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
            {TIMEZONE_LIST.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {tzSaved && (
            <span className="text-green-400 text-xs font-mono shrink-0">{m.setupPage.tzSaved}</span>
          )}
        </div>
      </div>

      <div className="w-full max-w-md bg-indigo-950 border border-indigo-700 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-indigo-400 font-semibold tracking-wide uppercase">{m.setupPage.step1}</p>
          <span data-testid="setup-os-badge" className="text-[10px] font-mono text-indigo-300 bg-indigo-900/60 border border-indigo-700 rounded px-1.5 py-0.5">
            {os === "windows" ? "Windows" : os === "mac" ? "macOS" : "Linux"}
          </span>
        </div>
        <p className="text-slate-100 font-medium text-sm">
          {tmpl(m.setupPage.step1Title, { term: os === "windows" ? m.setupPage.osTerminalWin : m.setupPage.osTerminalMac })}
        </p>
        <p className="text-xs text-slate-400">{m.setupPage.step1Sub}</p>
        <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-4 py-3">
          <code data-testid="setup-install-cmd" className="flex-1 text-sm text-indigo-300 font-mono break-all">{installCmd}</code>
          <button
            data-testid="setup-install-copy"
            onClick={() => copy(installCmd)}
            className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-md transition-colors font-medium"
          >
            {copied ? m.setupPage.copiedLabel : m.setupPage.copyLabel}
          </button>
        </div>
        <p className="text-xs text-slate-500">{m.setupPage.browserOpens}</p>
        <details className="text-xs text-slate-500 pt-2">
          <summary className="cursor-pointer hover:text-slate-300">{m.setupPage.manualNode}</summary>
          <div className="mt-2 flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2">
            <code data-testid="setup-npx-cmd" className="flex-1 text-[11px] text-slate-300 font-mono break-all">{npxCmd}</code>
            <button
              onClick={() => copy(npxCmd)}
              className="shrink-0 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] rounded font-medium"
            >{m.setupPage.copyLabel}</button>
          </div>
        </details>
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">{m.setupPage.step2Title}</p>
        {steps.map((step, i) => (
          <div
            key={i}
            data-testid={i === 0 ? "setup-step-hook" : "setup-step-first-session"}
            className="flex items-center gap-3 text-sm"
          >
            <span className={step.done ? "text-green-400" : "text-slate-600 animate-pulse"}>
              {step.done ? "✅" : "⏳"}
            </span>
            <span className={step.done ? "text-slate-200" : "text-slate-500"}>{step.label}</span>
          </div>
        ))}
        {!allDone && (
          <p className="text-xs text-slate-600 pt-1">{m.setupPage.waitingNote}</p>
        )}
        {allDone && (
          <div className="pt-2">
            <p className="text-xs text-green-400 mb-3">{m.setupPage.installDone}</p>
            <a
              data-testid="setup-go-dashboard"
              href="/dashboard"
              className="block w-full text-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {m.setupPage.goDashboard}
            </a>
          </div>
        )}
      </div>

      <a href="/setup-status" className="text-xs text-slate-600 hover:text-slate-400 underline">
        {m.setupPage.troubleshoot}
      </a>
    </div>
  );
}
