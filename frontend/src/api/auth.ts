import { apiFetch } from "./client";
import type { JobRank } from "./members";
export interface AuthMe {
  email: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  memberId: number | null;
  memberName: string | null;
  admin: boolean;
  // 승인됐지만 비활성으로 바뀐 팀원이면 false
  active?: boolean;
  // 부서·직책을 아직 입력하지 않았으면 false (내 정보 입력 화면 표시)
  profileComplete?: boolean;
  // 본인이 고른 프로필 색·이미지 (없으면 null)
  profileColor?: string | null;
  profileImageUrl?: string | null;
  // 개발자 권한 (다른 사람의 개발자 권한을 주거나 뺄 수 있음)
  developer?: boolean;
  // 직책 (사이드바 이름 옆에 표시, 아직 입력 전이면 null)
  jobRank?: JobRank | null;
}
export const getMe = () => apiFetch<AuthMe>("/api/auth/me");
export async function logout() {
  await apiFetch<void>("/api/auth/logout", { method: "POST" });
  window.location.assign("/");
}
