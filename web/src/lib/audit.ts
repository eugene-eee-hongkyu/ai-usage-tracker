// admin-v1 (Phase 4.1) — audit log INSERT helper.
//
// hash chain trigger 가 자동으로 prev_hash + row_hash 계산. app code 는 actor/action/
// target/metadata 만 박으면 됨.
//
// Phase 4.2 (M6a): teamId 필수. action 이 발생한 팀 scope. 보통 actor 의 currentTeamId.
// 시스템 (cron / signIn 거절 등) 발 행 audit 은 actor 가 없어 teamId=null 후보지만,
// schema 는 NOT NULL — 기본 팀 (1) 으로 박음. M6b 도입 시 system audit 의 의미 재검토.
//
// 사용:
//   await writeAudit({ teamId, actorUserId, action: 'user.invite', targetType: 'user', targetId, metadata: { email } });

import { db, auditLogs } from "@/lib/db";

interface WriteAuditParams {
  teamId?: number | null;        // M6a: 명시 안 하면 1 (iskra.world default 팀)
  actorUserId: number | null;
  actorType?: "user" | "service" | "system";
  action: string;
  targetType?: string | null;
  targetId?: number | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  // Phase 4.2 M6c — platform owner 의 view-as 모드에서 발생한 액션.
  // 호출자가 effectiveTeamId !== actor.currentTeamId 로 판정해 박는다.
  // hash chain input 에는 포함 안 됨 (옛 chain 보존).
  actorIsPlatformOwner?: boolean;
}

export async function writeAudit(p: WriteAuditParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      teamId: p.teamId ?? 1,
      actorUserId: p.actorUserId,
      actorType: p.actorType ?? "user",
      action: p.action,
      targetType: p.targetType ?? null,
      targetId: p.targetId ?? null,
      metadata: p.metadata ?? {},
      ip: p.ip ?? null,
      actorIsPlatformOwner: p.actorIsPlatformOwner ?? false,
      // prev_hash + row_hash 는 DB trigger 가 자동
      rowHash: "",  // trigger 가 overwrite. NOT NULL 제약 우회용 빈 문자열.
    });
  } catch (e) {
    // audit 실패는 silent — 메인 액션 진행에 영향 주면 안 됨. 다만 console.error 는 남김.
    console.error("[audit] write failed:", (e as Error).message);
  }
}
