import { apiFetch } from "./client";

export type JobRank = "HEAD" | "TEAM_LEAD" | "RESPONSIBLE" | "SENIOR";
export const JOB_RANKS: { value: JobRank; label: string }[] = [
  { value: "HEAD", label: "본부장" }, { value: "TEAM_LEAD", label: "팀장" },
  { value: "RESPONSIBLE", label: "책임" }, { value: "SENIOR", label: "선임" },
];

export interface MemberDto {
  id: number;
  name: string;
  active: boolean;
  admin?: boolean;
  email?: string | null;
  department?: string | null;
  jobRank?: JobRank | null;
  phone?: string | null;
}

export function listMembers(includeInactive: boolean): Promise<MemberDto[]> {
  return apiFetch<MemberDto[]>(`/api/members?includeInactive=${includeInactive}`);
}

// phone: 빈 문자열이면 지움
export function updateMember(id: number, patch: { name?: string; active?: boolean; department?: string; jobRank?: JobRank; phone?: string }): Promise<MemberDto> {
  return apiFetch<MemberDto>(`/api/members/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

// 퇴사자 등을 팀원 목록에서 삭제 (작성 기록·근무 상황·연차 기록은 그대로 남음)
export function deleteMember(id: number): Promise<void> {
  return apiFetch<void>(`/api/members/${id}`, { method: "DELETE" });
}

export function moveMember(id: number, beforeId: number | null): Promise<void> {
  return apiFetch<void>(`/api/members/${id}/position`, { method: "PATCH", body: JSON.stringify({ beforeId }) });
}
