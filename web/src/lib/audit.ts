// admin-v1 (Phase 4.1) — audit log INSERT helper.
//
// hash chain trigger 가 자동으로 prev_hash + row_hash 계산. app code 는 actor/action/
// target/metadata 만 박으면 됨.
//
// 사용:
//   await writeAudit({ actorUserId, action: 'user.invite', targetType: 'user', targetId, metadata: { email } });

import { db, auditLogs } from "@/lib/db";

interface WriteAuditParams {
  actorUserId: number | null;
  actorType?: "user" | "service" | "system";
  action: string;
  targetType?: string | null;
  targetId?: number | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export async function writeAudit(p: WriteAuditParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId: p.actorUserId,
      actorType: p.actorType ?? "user",
      action: p.action,
      targetType: p.targetType ?? null,
      targetId: p.targetId ?? null,
      metadata: p.metadata ?? {},
      ip: p.ip ?? null,
      // prev_hash + row_hash 는 DB trigger 가 자동
      rowHash: "",  // trigger 가 overwrite. NOT NULL 제약 우회용 빈 문자열.
    });
  } catch (e) {
    // audit 실패는 silent — 메인 액션 진행에 영향 주면 안 됨. 다만 console.error 는 남김.
    console.error("[audit] write failed:", (e as Error).message);
  }
}
