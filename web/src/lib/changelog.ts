// 릴리즈 노트 로더 + 미니 마크다운 렌더링.
// markdown 의존성 없이 자체 mini parser — # ## ### h, **bold**, `code`, - list, 빈 줄 단락.
// 파일 위치: web/src/lib/changelog-posts/*.md
//
// 형식 (한 파일 = 한 릴리즈):
//   ---
//   date: 2026-05-21
//   title: 노트북 여러 대 + 회사 자동 가입
//   ---
//
//   본문 markdown...

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

export interface ChangelogEntry {
  slug: string;         // 파일명 (확장자 제외) — date string 그대로 사용
  date: string;         // ISO date (YYYY-MM-DD)
  title: string;
  body: string;         // 본문 markdown (frontmatter 제거)
}

const POSTS_DIR = join(process.cwd(), "src/lib/changelog-posts");

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  // 단순 frontmatter: --- \n key: value \n --- \n body
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z_]+):\s*(.+)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

export function getAllChangelogEntries(): ChangelogEntry[] {
  let files: string[];
  try {
    files = readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const entries: ChangelogEntry[] = [];
  for (const f of files) {
    const raw = readFileSync(join(POSTS_DIR, f), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    entries.push({
      slug: f.replace(/\.md$/, ""),
      date: meta.date ?? f.replace(/\.md$/, ""),
      title: meta.title ?? f.replace(/\.md$/, ""),
      body,
    });
  }
  // 최신 위
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return entries;
}

// 본문 markdown → React-friendly mini-tokens.
// 지원: ## h2, ### h3, **bold**, `code`, - list, 빈 줄 = 단락.
export type MdToken =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; inline: InlineToken[] }
  | { kind: "ul"; items: InlineToken[][] };

export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string };

function parseInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // **bold** + `code` + 일반 텍스트. 우선순위: bold → code → text.
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", text: line.slice(last, m.index) });
    const piece = m[0];
    if (piece.startsWith("**")) {
      tokens.push({ kind: "bold", text: piece.slice(2, -2) });
    } else if (piece.startsWith("`")) {
      tokens.push({ kind: "code", text: piece.slice(1, -1) });
    }
    last = re.lastIndex;
  }
  if (last < line.length) tokens.push({ kind: "text", text: line.slice(last) });
  return tokens;
}

export function parseMarkdown(body: string): MdToken[] {
  const lines = body.split("\n");
  const tokens: MdToken[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      tokens.push({ kind: "h3", text: line.slice(4).trim() });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      tokens.push({ kind: "h2", text: line.slice(3).trim() });
      i++;
      continue;
    }
    if (line.startsWith("- ")) {
      const items: InlineToken[][] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(parseInline(lines[i].slice(2)));
        i++;
      }
      tokens.push({ kind: "ul", items });
      continue;
    }
    // 단락 — 다음 빈 줄까지 join (단일 줄도 단락)
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && !lines[i].startsWith("- ")) {
      buf.push(lines[i]);
      i++;
    }
    tokens.push({ kind: "p", inline: parseInline(buf.join(" ")) });
  }
  return tokens;
}
