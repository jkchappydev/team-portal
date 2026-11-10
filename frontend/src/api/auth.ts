import { apiFetch } from "./client";
export interface AuthMe {
  email: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  memberId: number | null;
  memberName: string | null;
  admin: boolean;
  // 승인됐지만 비활성으로 바뀐 팀원이면 false
  active?: boolean;
  // 부서·직급을 아직 입력하지 않았으면 false (내 정보 입력 화면 표시)
  profileComplete?: boolean;
  // 본인이 고른 프로필 색·이미지 (없으면 null)
  profileColor?: string | null;
  profileImageUrl?: string | null;
}
export const getMe = () => apiFetch<AuthMe>("/api/auth/me");
export async function logout() {
  await apiFetch<void>("/api/auth/logout", { method: "POST" });
  window.location.assign("/");
}
