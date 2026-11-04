import { apiFetch } from "./client";

export interface MemberDto {
  id: number;
  name: string;
  active: boolean;
}

export function listMembers(includeInactive: boolean): Promise<MemberDto[]> {
  return apiFetch<MemberDto[]>(`/api/members?includeInactive=${includeInactive}`);
}

export function createMember(name: string): Promise<MemberDto> {
  return apiFetch<MemberDto>("/api/members", { method: "POST", body: JSON.stringify({ name }) });
}

export function updateMember(id: number, patch: { name?: string; active?: boolean }): Promise<MemberDto> {
  return apiFetch<MemberDto>(`/api/members/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}
