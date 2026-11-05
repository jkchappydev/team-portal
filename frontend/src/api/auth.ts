import { apiFetch } from "./client";
export interface AuthMe {
  email: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  memberId: number | null;
  memberName: string | null;
  admin: boolean;
  // 승인됐지만 비활성으로 바뀐 팀원이면 false
  active?: boolean;
}
export const getMe = () => apiFetch<AuthMe>("/api/auth/me");
export async function logout() {
  await apiFetch<void>("/api/auth/logout", { method: "POST" });
  window.location.assign("/");
}
