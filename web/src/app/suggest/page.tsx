// /suggest — 사용자가 제품 개선 제안을 보내는 페이지.
// 로그인 필수. POST /api/suggest → DB insert + Resend 발송.
// GET /api/suggest → 본인이 보낸 최근 10건.

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";

const MAX_BODY = 4000;

type Category = "feature" | "ui" | "bug" | "other";
type Screen = "dashboard" | "team" | "settings" | "cli" | "changelog" | "other" | "";

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "feature", label: "새 기능" },
  { value: "ui", label: "UI 개선" },
  { value: "bug", label: "버그" },
  { value: "other", label: "기타" },
];

const SCREEN_OPTIONS: { value: Screen; label: string }[] = [
  { value: "", label: "(선택 안 함)" },
  { value: "dashboard", label: "대시보드" },
  { value: "team", label: "팀 랭킹" },
  { value: "settings", label: "세팅" },
  { value: "cli", label: "CLI" },
  { value: "changelog", label: "릴리즈 노트" },
  { value: "other", label: "기타" },
];

interface SuggestionItem {
  id: number;
  category: string;
  contextScreen: string | null;
  contextEntry: string | null;
  body: string;
  emailedAt: string | null;
  createdAt: string;
}

function SuggestPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  const initialEntry = params.get("entry") ?? "";
  const initialScreenParam = params.get("screen") ?? "";
  const initialScreen: Screen = (SCREEN_OPTIONS.find((s) => s.value === initialScreenParam)?.value ?? "") as Screen;

  const [category, setCategory] = useState<Category>("feature");
  const [screen, setScreen] = useState<Screen>(initialScreen || (initialEntry ? "changelog" : ""));
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { emailed: boolean }>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SuggestionItem[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/suggest")
      .then((r) => r.json())
      .then((d: { items?: SuggestionItem[] }) => setItems(d.items ?? []))
      .catch(() => { /* ignore */ });
  }, [status, done]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <Nav />
        <main className="max-w-3xl mx-auto px-4 py-8 text-sm text-neutral-500">불러오는 중…</main>
      </div>
    );
  }
  if (status === "unauthenticated") {
    router.push("/login?from=/suggest");
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 5) {
      setError("5자 이상 작성해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          contextScreen: screen || null,
          contextEntry: initialEntry || null,
          body: body.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "전송 실패");
        return;
      }
      setDone({ emailed: !!data.emailed });
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>💡 제안하기</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            더 나아졌으면 하는 부분을 알려주세요. 직접 읽고 답해요.
          </p>
        </header>

        {done ? (
          <div className="rounded border border-emerald-700 bg-emerald-950/40 p-6 space-y-3">
            <p className="text-emerald-200 font-semibold">✓ 보냈어요. 고마워요!</p>
            <p className="text-sm text-emerald-100/80">
              {done.emailed
                ? "info@z21labs.xyz 로 전달됐고, 답이 필요하면 회신드릴게요."
                : "저장은 됐지만 메일 전송에 실패했어요. 곧 재전송할게요."}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDone(null)}
                className="text-sm px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700"
              >
                하나 더 보내기
              </button>
              <Link
                href="/dashboard"
                className="text-sm px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500"
              >
                대시보드로 →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                카테고리
              </legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`text-sm px-3 py-1.5 rounded border cursor-pointer transition-colors ${
                      category === opt.value
                        ? "border-indigo-500 bg-indigo-950/50 text-indigo-100"
                        : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={opt.value}
                      checked={category === opt.value}
                      onChange={() => setCategory(opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                어떤 화면에 대한 제안인가요? (선택)
              </label>
              <select
                value={screen}
                onChange={(e) => setScreen(e.target.value as Screen)}
                className="w-full text-sm bg-neutral-900 border border-neutral-800 rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                {SCREEN_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {initialEntry && (
                <p className="text-xs text-neutral-500">
                  📌 릴리즈 노트 <span className="font-mono">{initialEntry}</span> 관련
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                내용
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
                rows={8}
                placeholder="어떤 점이 불편했나요? 또는 어떤 기능이 있으면 좋을까요?"
                className="w-full text-sm bg-neutral-900 border border-neutral-800 rounded px-3 py-2 leading-relaxed focus:outline-none focus:border-indigo-500"
              />
              <div className="text-xs text-neutral-500 text-right">
                {body.length} / {MAX_BODY}
              </div>
            </div>

            <p className="text-xs text-neutral-500">
              보내는이 · <span className="text-neutral-300">{session?.user?.email}</span> (세션에서 자동)
            </p>

            {error && (
              <p className="text-sm text-rose-400">{humanError(error)}</p>
            )}

            <div className="flex justify-end gap-2">
              <Link
                href="/dashboard"
                className="text-sm px-4 py-2 rounded text-neutral-400 hover:text-neutral-200"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={submitting || body.trim().length < 5}
                className="text-sm px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed"
              >
                {submitting ? "보내는 중…" : "제안 보내기 →"}
              </button>
            </div>
          </form>
        )}

        {items.length > 0 && (
          <section className="space-y-3 pt-4">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              최근 보낸 제안
            </h2>
            <ul className="divide-y divide-neutral-800 border-y border-neutral-800">
              {items.map((it) => (
                <li key={it.id} className="py-3 text-sm">
                  <div className="flex items-baseline gap-3 text-xs text-neutral-500">
                    <span className="font-mono shrink-0">
                      {new Date(it.createdAt).toLocaleDateString("ko", {
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    <span>{categoryLabel(it.category)}</span>
                    {it.contextScreen && <span>· {it.contextScreen}</span>}
                    <span className="ml-auto">
                      {it.emailedAt ? (
                        <span className="text-emerald-500">✓ 전송됨</span>
                      ) : (
                        <span className="text-amber-500">대기</span>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-300 line-clamp-2 leading-relaxed">{it.body}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function categoryLabel(c: string): string {
  return CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c;
}

function humanError(code: string): string {
  if (code === "body_too_short") return "5자 이상 작성해주세요.";
  if (code === "body_too_long") return "너무 길어요. 4000자 이내로 줄여주세요.";
  if (code === "invalid_category") return "카테고리를 선택해주세요.";
  if (code === "unauthorized") return "로그인이 필요해요.";
  return `전송 실패 (${code})`;
}

export default function SuggestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950" />}>
      <SuggestPageInner />
    </Suspense>
  );
}
