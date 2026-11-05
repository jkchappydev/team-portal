import { apiFetch } from "./client";
export interface AuthMe {
  email: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  memberId: number | null;
  memberName: string | null;
  admin: boolean;
}
export const getMe = () => apiFetch<AuthMe>("/api/auth/me");
export async function logout() {
  await apiFetch<void>("/api/auth/logout", { method: "POST" });
  window.location.assign("/");
}
