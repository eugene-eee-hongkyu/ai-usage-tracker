// admin-v1 (Phase 4.1) — Resend 이메일 발송 wrapper.
//
// 환경:
//   RESEND_API_KEY                Resend dashboard 의 API key
//   EMAIL_FROM=AI Usage Tracker <noreply@aiusage.z21labs.world>
//   PUBLIC_APP_URL=https://aiusage.z21labs.world  (초대 링크 base URL)
//
// 도메인 (aiusage.z21labs.world) 의 DKIM/SPF/DMARC 가 verified 되어야 발송 가능.
// Resend dashboard 의 "Verifying domain" 상태가 ✓ 로 바뀐 후 동작.

import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "AI Usage Tracker <noreply@aiusage.z21labs.world>";
const APP_URL = process.env.PUBLIC_APP_URL ?? "https://aiusage.z21labs.world";

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  const r = client();
  if (!r) return { ok: false, error: "RESEND_API_KEY missing" };
  try {
    const result = await r.emails.send({ from: FROM, to, subject, html });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// HTML 본문에 사용자 입력 (inviterName 등) 을 inject 할 때 escape — 옛 코드는
// `${p.inviterName}` 같이 직접 inject 해서 OAuth provider 가 검증한 이름이라도
// 명시 escape 가 안전망. sendSuggestion 의 safe() 와 동일 정책.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── 템플릿 ───────────────────────────────────────────────────────────────

type Locale = "ko" | "en" | "ja" | "zh";

interface InvitationParams {
  to: string;
  inviterName: string;
  token: string;
  locale?: Locale;
}

// Phase 4.2 M6c — invitation 4 언어 + platform owner 접근 공지.
// 새 회사 owner 가 가입 시 약관처럼 명시. legal 문서는 아니지만 분쟁 가능성 차단.
const I18N = {
  ko: {
    subject: (n: string) => `AI Usage Tracker — ${n} 님이 초대했습니다`,
    title: "AI Usage Tracker 초대",
    inviterLine: (n: string) => `<strong>${n}</strong> 님이 당신을 팀에 초대했습니다.`,
    instruction: "아래 버튼을 클릭해서 GitHub 또는 Google 로 로그인하면 즉시 가입됩니다.",
    button: "초대 수락",
    fallback: "또는 다음 링크를 브라우저에 직접 붙여넣기:",
    expiry: "이 초대는 7일 후 만료됩니다. 의도하지 않은 초대라면 이 메일을 무시하세요.",
    platformNotice:
      "운영 (장애 대응·버그 추적) 목적으로 플랫폼 운영자가 귀하의 워크스페이스에 접근할 수 있으며, 모든 접근은 귀하의 감사 로그에 기록됩니다.",
  },
  en: {
    subject: (n: string) => `AI Usage Tracker — ${n} invited you`,
    title: "AI Usage Tracker invitation",
    inviterLine: (n: string) => `<strong>${n}</strong> invited you to join their team.`,
    instruction: "Click below to sign in with GitHub or Google — you'll be added automatically.",
    button: "Accept invitation",
    fallback: "Or paste this link into your browser:",
    expiry: "This invitation expires in 7 days. Ignore this email if it wasn't expected.",
    platformNotice:
      "For operational support (incident response, debugging), the platform operator may access your workspace. All access is recorded in your audit log.",
  },
  ja: {
    subject: (n: string) => `AI Usage Tracker — ${n} さんから招待が届きました`,
    title: "AI Usage Tracker の招待",
    inviterLine: (n: string) => `<strong>${n}</strong> さんがチームに招待しました。`,
    instruction: "下のボタンから GitHub または Google でログインすると、自動的に参加できます。",
    button: "招待を承諾",
    fallback: "またはこのリンクをブラウザに貼り付けてください:",
    expiry: "この招待は 7 日後に期限切れとなります。心当たりがない場合は無視してください。",
    platformNotice:
      "運用上の理由 (障害対応・バグ調査) により、プラットフォーム運営者がワークスペースにアクセスする場合があります。すべてのアクセスは監査ログに記録されます。",
  },
  zh: {
    subject: (n: string) => `AI Usage Tracker — ${n} 邀请您加入`,
    title: "AI Usage Tracker 邀请",
    inviterLine: (n: string) => `<strong>${n}</strong> 邀请您加入团队。`,
    instruction: "请点击下方按钮,使用 GitHub 或 Google 登录即可自动加入。",
    button: "接受邀请",
    fallback: "或将此链接粘贴到浏览器中:",
    expiry: "此邀请将在 7 天后过期。如不是您预期的邀请,请忽略此邮件。",
    platformNotice:
      "出于运营支持目的 (故障响应、问题排查),平台运营方可访问您的工作区。所有访问均记录在您的审计日志中。",
  },
} satisfies Record<Locale, unknown>;

function resolveLocale(l?: Locale): Locale {
  if (l === "en" || l === "ja" || l === "zh") return l;
  return "ko";
}

export async function sendInvitation(p: InvitationParams): Promise<SendResult> {
  const url = `${APP_URL}/login?invite=${encodeURIComponent(p.token)}`;
  const t = I18N[resolveLocale(p.locale)];
  // inviterName 은 OAuth provider 에서 온 이름이지만 메일 클라이언트의 HTML
  // 렌더 안전망. subject 는 헤더 — Resend SDK 가 CRLF stripping 한다고 가정,
  // 추가로 \r\n 제거.
  const safeInviter = escapeHtml(p.inviterName);
  const subject = t.subject(p.inviterName).replace(/[\r\n]+/g, " ");
  const html = `<!doctype html><html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px; color: #0f172a; line-height: 1.6;">
      <h2 style="margin:0 0 16px">${t.title}</h2>
      <p>${t.inviterLine(safeInviter)}</p>
      <p>${t.instruction}</p>
      <p style="margin: 32px 0;">
        <a href="${url}" style="background:#4f46e5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">${t.button}</a>
      </p>
      <p style="font-size:13px; color:#64748b;">${t.fallback}<br><a href="${url}" style="color:#64748b; word-break:break-all;">${url}</a></p>
      <p style="font-size:12px; color:#94a3b8; margin-top: 32px;">${t.expiry}</p>
      <hr style="border:none; border-top:1px solid #e2e8f0; margin: 24px 0;">
      <p style="font-size:11px; color:#94a3b8; line-height: 1.5;">${t.platformNotice}</p>
    </body></html>`;
  return send(p.to, subject, html);
}

interface JoinApprovedParams {
  to: string;
  approverName: string;
  locale?: "ko" | "en";
}

interface SuggestionParams {
  fromName: string;
  fromEmail: string;
  category: string;       // 'feature' | 'ui' | 'bug' | 'other'
  contextScreen?: string | null;
  contextEntry?: string | null;
  body: string;
}

const SUGGEST_TO = process.env.SUGGEST_TO_EMAIL ?? "info@z21lab.xyz";

const CATEGORY_LABEL: Record<string, string> = {
  feature: "새 기능",
  ui: "UI 개선",
  bug: "버그",
  other: "기타",
};

export async function sendSuggestion(p: SuggestionParams): Promise<SendResult> {
  const cat = CATEGORY_LABEL[p.category] ?? p.category;
  const screen = p.contextScreen ? `화면: ${p.contextScreen}` : "";
  const entry = p.contextEntry ? `릴리즈: ${p.contextEntry}` : "";
  const meta = [screen, entry].filter(Boolean).join(" / ");
  const subject = `[AI Usage Tracker · ${cat}] ${p.fromName} 님의 제안`;
  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 24px; color: #0f172a; line-height: 1.6;">
      <h2 style="margin:0 0 16px">새 제안이 도착했습니다</h2>
      <table style="font-size:13px; color:#475569; border-collapse:collapse; margin-bottom:20px;">
        <tr><td style="padding:4px 12px 4px 0;">보내는이</td><td><strong style="color:#0f172a;">${safe(p.fromName)}</strong> &lt;${safe(p.fromEmail)}&gt;</td></tr>
        <tr><td style="padding:4px 12px 4px 0;">카테고리</td><td>${cat}</td></tr>
        ${meta ? `<tr><td style="padding:4px 12px 4px 0;">컨텍스트</td><td>${safe(meta)}</td></tr>` : ""}
      </table>
      <div style="background:#f8fafc; border-left:3px solid #4f46e5; padding:16px; border-radius:4px; white-space:pre-wrap; font-size:14px;">${safe(p.body)}</div>
      <p style="font-size:11px; color:#94a3b8; margin-top:24px;">aiusage.z21labs.world · 회신은 ${safe(p.fromEmail)} 로 직접</p>
    </body></html>`;
  const r = client();
  if (!r) return { ok: false, error: "RESEND_API_KEY missing" };
  try {
    const result = await r.emails.send({
      from: FROM,
      to: SUGGEST_TO,
      replyTo: p.fromEmail,
      subject,
      html,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function sendJoinApproved(p: JoinApprovedParams): Promise<SendResult> {
  const url = `${APP_URL}/dashboard`;
  const ko = p.locale !== "en";
  const subject = ko
    ? "AI Usage Tracker — 가입 승인됨"
    : "AI Usage Tracker — Join request approved";
  const safeApprover = escapeHtml(p.approverName);
  const html = ko
    ? `<!doctype html><html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px; color: #0f172a; line-height: 1.6;">
      <h2 style="margin:0 0 16px">가입 승인됨 ✅</h2>
      <p><strong>${safeApprover}</strong> 님이 당신의 가입을 승인했습니다.</p>
      <p>이제 install.sh 를 다시 실행해 본인 머신을 연결하세요:</p>
      <pre style="background:#0f172a; color:#e2e8f0; padding:16px; border-radius:6px; overflow-x:auto;">curl -fsSL ${APP_URL}/install.sh | bash</pre>
      <p style="margin: 32px 0;">
        <a href="${url}" style="background:#4f46e5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">대시보드 열기</a>
      </p>
    </body></html>`
    : `<!doctype html><html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px; color: #0f172a; line-height: 1.6;">
      <h2 style="margin:0 0 16px">Join request approved ✅</h2>
      <p><strong>${safeApprover}</strong> approved your join request.</p>
      <p>Run install.sh on your machine to connect:</p>
      <pre style="background:#0f172a; color:#e2e8f0; padding:16px; border-radius:6px; overflow-x:auto;">curl -fsSL ${APP_URL}/install.sh | bash</pre>
      <p style="margin: 32px 0;">
        <a href="${url}" style="background:#4f46e5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">Open dashboard</a>
      </p>
    </body></html>`;
  return send(p.to, subject, html);
}
