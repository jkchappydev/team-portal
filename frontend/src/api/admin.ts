import { apiFetch } from "./client";
import type { MemberDto } from "./members";
import type { JobRank } from "./members";

export interface SignupRequestDto {
  id: number;
  email: string;
  googleName: string;
  status: "PENDING" | "REJECTED";
  requestedAt: string;
  // 삭제했던 팀원의 재가입이면 이전 팀원 정보 (승인 시 기본으로 다시 연결)
  previousMemberId?: number | null;
  previousMemberName?: string | null;
  previousDepartment?: string | null;
  previousJobRank?: JobRank | null;
}
export const listSignupRequests = () => apiFetch<SignupRequestDto[]>("/api/admin/signup-requests");
export const countPendingSignups = async () => (await apiFetch<{ pending: number }>("/api/admin/signup-requests/count")).pending;
export const approveSignup = (id: number, data: { memberId: number } | { newMemberName: string }) =>
  apiFetch<void>(`/api/admin/signup-requests/${id}/approve`, { method: "POST", body: JSON.stringify(data) });
export const rejectSignup = (id: number) => apiFetch<void>(`/api/admin/signup-requests/${id}/reject`, { method: "POST" });
export const reopenSignup = (id: number) => apiFetch<void>(`/api/admin/signup-requests/${id}/reopen`, { method: "POST" });
export const setMemberAdmin = (id: number, admin: boolean) => apiFetch<MemberDto>(`/api/admin/members/${id}/admin`, { method: "PATCH", body: JSON.stringify({ admin }) });
// 개발자 권한은 개발자만 주거나 뺄 수 있음 (주면 관리자 권한도 함께)
export const setMemberDeveloper = (id: number, developer: boolean) => apiFetch<MemberDto>(`/api/admin/members/${id}/developer`, { method: "PATCH", body: JSON.stringify({ developer }) });
