// admin-v1 (Phase 4.1) — NextAuth session.user 타입 확장.
// auth.ts 의 session callback 이 박는 필드들을 client/server 모두 type-safe 접근.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: number;
      role?: string;                 // 'member' | 'admin' (DB users.role)
      permissions?: {
        membershipAdmin?: boolean;   // 사용자 관리 권한 (초대/승인/suspend/delete)
        billingAdmin?: boolean;      // 비용 dashboard 권한 (개인 cost 분해 보기)
      };
      suspendedAt?: Date | null;
      deletedAt?: Date | null;
      isOwner?: boolean;             // ADMIN_EMAIL env 화이트리스트
      isAdmin?: boolean;             // isOwner || any permission. nav 어드민 메뉴 노출 조건
    };
  }
}
