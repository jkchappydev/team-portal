import { apiFetch } from "./client";

// 사이드바 최상위 항목 종류: 프로젝트는 메인 화면 갤러리에 보이고, 페이지는 보이지 않음
export type SpaceKind = "PROJECT" | "PAGE";

export interface SpaceDto {
  id: number;
  name: string;
  description: string | null;
  documentCount: number;
  // 프로젝트 본문 페이지 문서 ID
  homeDocumentId: number | null;
  kind: SpaceKind;
  // 본문 페이지의 이모지 아이콘 (null이면 없음)
  icon: string | null;
  // 본문 페이지 커버 (att:{첨부 ID} 또는 https 주소, null이면 없음)
  cover: string | null;
}

export function listSpaces(): Promise<SpaceDto[]> {
  return apiFetch<SpaceDto[]>("/api/spaces");
}

// 이름 없이 만들면 서버가 "제목 없음"으로 만들고, 화면에서 바로 이름을 입력
export function createSpace(name?: string, description?: string, kind?: SpaceKind): Promise<SpaceDto> {
  return apiFetch<SpaceDto>("/api/spaces", { method: "POST", body: JSON.stringify({ name, description, kind }) });
}

export function updateSpace(id: number, name: string, description?: string): Promise<SpaceDto> {
  return apiFetch<SpaceDto>(`/api/spaces/${id}`, { method: "PATCH", body: JSON.stringify({ name, description }) });
}

export function deleteSpace(id: number): Promise<void> {
  return apiFetch<void>(`/api/spaces/${id}`, { method: "DELETE" });
}

// 사이드바에서 끌어 옮긴 최상위 페이지를 index 위치로 (0이 맨 위)
export function moveSpace(id: number, index: number): Promise<void> {
  return apiFetch<void>(`/api/spaces/${id}/position`, { method: "PATCH", body: JSON.stringify({ index }) });
}

export function restoreSpace(id: number): Promise<void> {
  return apiFetch<void>(`/api/spaces/${id}/restore`, { method: "POST" });
}
