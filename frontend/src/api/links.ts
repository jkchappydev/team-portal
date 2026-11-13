import { apiFetch } from "./client";

// 사이드바 "링크"에 팀이 함께 걸어 두는 외부 주소
export interface LinkDto {
  id: number;
  title: string;
  url: string;
  // 이모지 아이콘 (없으면 null, 화면에서 기본 🔗)
  icon: string | null;
}

export const LINKS_KEY = ["links"];

export function listLinks(): Promise<LinkDto[]> {
  return apiFetch<LinkDto[]>("/api/links");
}

export function createLink(url: string, title: string, icon?: string | null): Promise<LinkDto> {
  return apiFetch<LinkDto>("/api/links", { method: "POST", body: JSON.stringify({ url, title, icon: icon ?? null }) });
}

export function renameLink(id: number, title: string): Promise<LinkDto> {
  return apiFetch<LinkDto>(`/api/links/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
}

// 끌어 옮긴 링크를 index 위치로 (0이 맨 위)
export function moveLink(id: number, index: number): Promise<void> {
  return apiFetch<void>(`/api/links/${id}/position`, { method: "PATCH", body: JSON.stringify({ index }) });
}

export function deleteLink(id: number): Promise<void> {
  return apiFetch<void>(`/api/links/${id}`, { method: "DELETE" });
}
