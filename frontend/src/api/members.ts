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
}

export function listMembers(includeInactive: boolean): Promise<MemberDto[]> {
  return apiFetch<MemberDto[]>(`/api/members?includeInactive=${includeInactive}`);
}

export function createMember(name: string): Promise<MemberDto> {
  return apiFetch<MemberDto>("/api/members", { method: "POST", body: JSON.stringify({ name }) });
}

export function updateMember(id: number, patch: { name?: string; active?: boolean; department?: string; jobRank?: JobRank }): Promise<MemberDto> {
  return apiFetch<MemberDto>(`/api/members/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function moveMember(id: number, beforeId: number | null): Promise<void> {
  return apiFetch<void>(`/api/members/${id}/position`, { method: "PATCH", body: JSON.stringify({ beforeId }) });
}
