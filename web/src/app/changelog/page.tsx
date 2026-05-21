// /changelog — 릴리즈 노트.
// markdown 의존성 없이 src/lib/changelog 의 mini parser 사용.
// 한 파일 = 한 entry. 새 entry 는 src/lib/changelog-posts/YYYY-MM-DD.md 추가.

import {
  getAllChangelogEntries,
  parseMarkdown,
  type ChangelogEntry,
  type InlineToken,
  type MdToken,
} from "@/lib/changelog";
import { Nav } from "@/components/nav";
import Link from "next/link";

export const dynamic = "force-static";

export default function ChangelogPage() {
  const entries = getAllChangelogEntries();
  const [latest, ...rest] = entries;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">릴리즈 노트</h1>
            <p className="text-sm text-neutral-400 mt-1">
              새로 추가된 기능과 개선 사항을 알려드려요.
            </p>
          </div>
          <Link
            href="/suggest"
            className="shrink-0 text-xs px-3 py-1.5 rounded border border-neutral-700 text-neutral-300 hover:border-indigo-500 hover:text-indigo-300 transition-colors inline-flex items-center gap-1.5"
          >
            💡 제안하기
          </Link>
        </header>

        {entries.length === 0 ? (
          <p className="text-sm text-neutral-500">아직 등록된 릴리즈가 없습니다.</p>
        ) : (
          <>
            <EntryArticle entry={latest} />

            {rest.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  이전 릴리즈 ({rest.length})
                </h2>
                <ul className="divide-y divide-neutral-800 border-y border-neutral-800">
                  {rest.map((entry) => (
                    <li key={entry.slug}>
                      <details className="group">
                        <summary className="flex items-baseline gap-3 py-3 cursor-pointer list-none hover:bg-neutral-900/50 -mx-2 px-2 rounded">
                          <span className="text-xs text-neutral-500 font-mono shrink-0 w-24">
                            {formatDate(entry.date)}
                          </span>
                          <span className="text-sm text-neutral-200 flex-1">{entry.title}</span>
                          <span className="text-xs text-neutral-600 group-open:rotate-90 transition-transform">
                            ▸
                          </span>
                        </summary>
                        <div className="pb-4 pt-1 pl-[7.25rem] pr-2 space-y-2 text-sm text-neutral-300 leading-relaxed">
                          {parseMarkdown(entry.body).map((t, i) => (
                            <MdNode key={i} token={t} />
                          ))}
                          <EntryFeedbackLink slug={entry.slug} />
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function EntryArticle({ entry }: { entry: ChangelogEntry }) {
  return (
    <article className="border-l-2 border-neutral-800 pl-5 space-y-3">
      <div>
        <p className="text-xs text-neutral-500 font-mono">{formatDate(entry.date)}</p>
        <h2 className="text-lg font-bold text-neutral-100 mt-1">{entry.title}</h2>
      </div>
      <div className="space-y-2 text-sm text-neutral-300 leading-relaxed">
        {parseMarkdown(entry.body).map((t, i) => (
          <MdNode key={i} token={t} />
        ))}
      </div>
      <EntryFeedbackLink slug={entry.slug} />
    </article>
  );
}

function EntryFeedbackLink({ slug }: { slug: string }) {
  return (
    <div className="pt-2 text-right">
      <Link
        href={`/suggest?entry=${slug}`}
        className="text-xs text-neutral-500 hover:text-indigo-400 transition-colors"
      >
        이 변경에 대한 의견 보내기 →
      </Link>
    </div>
  );
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("ko", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function MdNode({ token }: { token: MdToken }) {
  if (token.kind === "h2") {
    return <h3 className="text-base font-semibold text-neutral-100 mt-4">{token.text}</h3>;
  }
  if (token.kind === "h3") {
    return <h4 className="text-sm font-semibold text-neutral-200 mt-2">{token.text}</h4>;
  }
  if (token.kind === "ul") {
    return (
      <ul className="list-disc list-inside space-y-1 ml-2">
        {token.items.map((items, i) => (
          <li key={i}>
            <Inline tokens={items} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p>
      <Inline tokens={token.inline} />
    </p>
  );
}

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((t, i) => {
        if (t.kind === "bold") return <strong key={i} className="text-neutral-100">{t.text}</strong>;
        if (t.kind === "code") return <code key={i} className="text-cyan-400 text-xs bg-neutral-900 px-1 rounded">{t.text}</code>;
        return <span key={i}>{t.text}</span>;
      })}
    </>
  );
}
