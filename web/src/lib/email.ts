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

// ── 템플릿 ───────────────────────────────────────────────────────────────

interface InvitationParams {
  to: string;
  inviterName: string;
  token: string;
  locale?: "ko" | "en";
}

export async function sendInvitation(p: InvitationParams): Promise<SendResult> {
  const url = `${APP_URL}/login?invite=${encodeURIComponent(p.token)}`;
  const ko = p.locale !== "en";
  const subject = ko
    ? `AI Usage Tracker — ${p.inviterName} 님이 초대했습니다`
    : `AI Usage Tracker — ${p.inviterName} invited you`;
  const html = ko
    ? `<!doctype html><html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px; color: #0f172a; line-height: 1.6;">
      <h2 style="margin:0 0 16px">AI Usage Tracker 초대</h2>
      <p><strong>${p.inviterName}</strong> 님이 당신을 팀에 초대했습니다.</p>
      <p>아래 버튼을 클릭해서 GitHub 또는 Google 로 로그인하면 즉시 가입됩니다.</p>
      <p style="margin: 32px 0;">
        <a href="${url}" style="background:#4f46e5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">초대 수락</a>
      </p>
      <p style="font-size:13px; color:#64748b;">또는 다음 링크를 브라우저에 직접 붙여넣기:<br><a href="${url}" style="color:#64748b; word-break:break-all;">${url}</a></p>
      <p style="font-size:12px; color:#94a3b8; margin-top: 32px;">이 초대는 7일 후 만료됩니다. 의도하지 않은 초대라면 이 메일을 무시하세요.</p>
    </body></html>`
    : `<!doctype html><html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px; color: #0f172a; line-height: 1.6;">
      <h2 style="margin:0 0 16px">AI Usage Tracker invitation</h2>
      <p><strong>${p.inviterName}</strong> invited you to join their team.</p>
      <p>Click below to sign in with GitHub or Google — you'll be added automatically.</p>
      <p style="margin: 32px 0;">
        <a href="${url}" style="background:#4f46e5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">Accept invitation</a>
      </p>
      <p style="font-size:13px; color:#64748b;">Or paste this link into your browser:<br><a href="${url}" style="color:#64748b; word-break:break-all;">${url}</a></p>
      <p style="font-size:12px; color:#94a3b8; margin-top: 32px;">This invitation expires in 7 days. Ignore this email if it wasn't expected.</p>
    </body></html>`;
  return send(p.to, subject, html);
}

interface JoinApprovedParams {
  to: string;
  approverName: string;
  locale?: "ko" | "en";
}

export async function sendJoinApproved(p: JoinApprovedParams): Promise<SendResult> {
  const url = `${APP_URL}/dashboard`;
  const ko = p.locale !== "en";
  const subject = ko
    ? "AI Usage Tracker — 가입 승인됨"
    : "AI Usage Tracker — Join request approved";
  const html = ko
    ? `<!doctype html><html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px; color: #0f172a; line-height: 1.6;">
      <h2 style="margin:0 0 16px">가입 승인됨 ✅</h2>
      <p><strong>${p.approverName}</strong> 님이 당신의 가입을 승인했습니다.</p>
      <p>이제 install.sh 를 다시 실행해 본인 머신을 연결하세요:</p>
      <pre style="background:#0f172a; color:#e2e8f0; padding:16px; border-radius:6px; overflow-x:auto;">curl -fsSL ${APP_URL}/install.sh | bash</pre>
      <p style="margin: 32px 0;">
        <a href="${url}" style="background:#4f46e5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">대시보드 열기</a>
      </p>
    </body></html>`
    : `<!doctype html><html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px; color: #0f172a; line-height: 1.6;">
      <h2 style="margin:0 0 16px">Join request approved ✅</h2>
      <p><strong>${p.approverName}</strong> approved your join request.</p>
      <p>Run install.sh on your machine to connect:</p>
      <pre style="background:#0f172a; color:#e2e8f0; padding:16px; border-radius:6px; overflow-x:auto;">curl -fsSL ${APP_URL}/install.sh | bash</pre>
      <p style="margin: 32px 0;">
        <a href="${url}" style="background:#4f46e5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">Open dashboard</a>
      </p>
    </body></html>`;
  return send(p.to, subject, html);
}
