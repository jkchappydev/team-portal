import { apiFetch } from "./client";

export interface DocumentSummaryDto {
  id: number;
  spaceId: number;
  spaceName: string | null;
  title: string;
  // 이모지 아이콘 (null이면 없음)
  icon: string | null;
  updatedByName: string | null;
  updatedAt: string;
  // 상위 페이지 (null이면 최상위)
  parentId: number | null;
  // PAGE: 편집하는 페이지, FILE: 내려받는 파일 항목
  kind: "PAGE" | "FILE";
  // 파일 항목의 다운로드 주소 (페이지는 null)
  fileUrl: string | null;
}

export interface PageRefDto {
  id: number;
  title: string;
  icon: string | null;
}

export interface DocumentDetailDto {
  id: number;
  spaceId: number;
  spaceName: string | null;
  title: string;
  icon: string | null;
  createdByName: string | null;
  updatedByName: string | null;
  updatedAt: string;
  // 프로젝트 본문 페이지 여부
  home: boolean;
  parentId: number | null;
  // 최상위부터 바로 위 페이지까지
  path: PageRefDto[];
  // PAGE: 페이지, FILE: 파일 항목
  kind: "PAGE" | "FILE";
  // 파일 항목의 다운로드 주소 (페이지는 null)
  fileUrl: string | null;
}

// 상위와 함께 숨겨진 하위 페이지 (depth 1이 바로 아래)
export interface TrashChildDto {
  id: number;
  title: string;
  icon: string | null;
  depth: number;
}

export interface TrashItemDto {
  // space: 프로젝트(최상위 페이지), document: 페이지
  kind: "space" | "document";
  id: number;
  name: string;
  icon: string | null;
  deletedAt: string;
  // 깊이 우선 순서
  children: TrashChildDto[];
}

// 삭제된 프로젝트와 페이지를 최근 삭제순으로 함께 담은 목록
export interface TrashDto {
  items: TrashItemDto[];
}

export function listDocuments(spaceId: number): Promise<DocumentSummaryDto[]> {
  return apiFetch<DocumentSummaryDto[]>(`/api/spaces/${spaceId}/documents`);
}

export function createDocument(spaceId: number, parentId?: number | null, title?: string): Promise<DocumentSummaryDto> {
  return apiFetch<DocumentSummaryDto>(`/api/spaces/${spaceId}/documents`, {
    method: "POST",
    body: JSON.stringify({ title: title || undefined, parentId: parentId ?? undefined }),
  });
}

export function getDocument(id: number): Promise<DocumentDetailDto> {
  return apiFetch<DocumentDetailDto>(`/api/documents/${id}`);
}

export function renameDocument(id: number, title: string): Promise<DocumentDetailDto> {
  return apiFetch<DocumentDetailDto>(`/api/documents/${id}/title`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

// 사이드바 트리에 파일 항목 올리기 (parentId 없으면 최상위, index 없으면 맨 아래)
export function uploadFileNode(spaceId: number, file: File, parentId: number | null, index?: number): Promise<DocumentSummaryDto> {
  const form = new FormData();
  form.append("file", file);
  if (parentId !== null) form.append("parentId", String(parentId));
  if (index !== undefined) form.append("index", String(index));
  return apiFetch<DocumentSummaryDto>(`/api/spaces/${spaceId}/files`, { method: "POST", body: form });
}

// parentId가 null이면 최상위로 이동 (하위 페이지는 함께 따라옴)
// index는 새 상위 페이지 안에서 들어갈 위치 (0이 맨 위, 없으면 맨 아래)
export function moveDocument(id: number, parentId: number | null, index?: number): Promise<DocumentDetailDto> {
  return apiFetch<DocumentDetailDto>(`/api/documents/${id}/parent`, {
    method: "PATCH",
    body: JSON.stringify({ parentId, index }),
  });
}

// icon이 null이면 아이콘 제거
export function changeDocumentIcon(id: number, icon: string | null): Promise<DocumentDetailDto> {
  return apiFetch<DocumentDetailDto>(`/api/documents/${id}/icon`, {
    method: "PATCH",
    body: JSON.stringify({ icon }),
  });
}

export function deleteDocument(id: number): Promise<void> {
  return apiFetch<void>(`/api/documents/${id}`, { method: "DELETE" });
}

export function restoreDocument(id: number): Promise<void> {
  return apiFetch<void>(`/api/documents/${id}/restore`, { method: "POST" });
}

export function searchDocuments(q: string): Promise<DocumentSummaryDto[]> {
  return apiFetch<DocumentSummaryDto[]>(`/api/documents/search?q=${encodeURIComponent(q)}`);
}

export function getTrash(): Promise<TrashDto> {
  return apiFetch<TrashDto>("/api/trash");
}

// 휴지통 항목 영구 삭제 (하위 페이지와 첨부 파일까지 지우며 되돌릴 수 없음)
export function purgeTrashItem(kind: TrashItemDto["kind"], id: number): Promise<void> {
  const path = kind === "space" ? "spaces" : "documents";
  return apiFetch<void>(`/api/trash/${path}/${id}`, { method: "DELETE" });
}
