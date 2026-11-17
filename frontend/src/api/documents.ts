import { apiFetch } from "./client";

// PAGE: 편집하는 페이지, FILE: 내려받는 파일 항목, WBS: 작업 일정표
export type DocumentKind = "PAGE" | "FILE" | "WBS";

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
  kind: DocumentKind;
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
  // 프로젝트 본문 커버 (att:{첨부 ID} 또는 https 주소, 일반 페이지·없으면 null)
  cover: string | null;
  createdByName: string | null;
  updatedByName: string | null;
  updatedAt: string;
  // 프로젝트 본문 페이지 여부
  home: boolean;
  parentId: number | null;
  // 최상위부터 바로 위 페이지까지
  path: PageRefDto[];
  kind: DocumentKind;
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
  // space일 때 PROJECT 또는 PAGE (document는 null)
  spaceKind: "PROJECT" | "PAGE" | null;
  deletedAt: string;
  // 깊이 우선 순서
  children: TrashChildDto[];
}

// 삭제된 프로젝트와 페이지를 최근 삭제순으로 함께 담은 목록
export interface TrashDto {
  items: TrashItemDto[];
}

// kind가 없으면 페이지 (파일 항목은 더 만들지 않음, 본문 /페이지·/일정이 사용)
export function createDocument(spaceId: number, parentId?: number | null, title?: string,
  kind?: Exclude<DocumentKind, "FILE">): Promise<DocumentSummaryDto> {
  return apiFetch<DocumentSummaryDto>(`/api/spaces/${spaceId}/documents`, {
    method: "POST",
    body: JSON.stringify({ title: title || undefined, parentId: parentId ?? undefined, kind: kind ?? undefined }),
  });
}

// 본문 페이지 블록 복제용 페이지 사본 생성 (같은 상위의 맨 아래, 제목 뒤 "(사본)")
export function duplicateDocument(id: number): Promise<DocumentSummaryDto> {
  return apiFetch<DocumentSummaryDto>(`/api/documents/${id}/duplicate`, { method: "POST" });
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

// icon이 null이면 아이콘 제거
export function changeDocumentIcon(id: number, icon: string | null): Promise<DocumentDetailDto> {
  return apiFetch<DocumentDetailDto>(`/api/documents/${id}/icon`, {
    method: "PATCH",
    body: JSON.stringify({ icon }),
  });
}

// cover가 null이면 커버 제거 (프로젝트 본문만)
export function changeDocumentCover(id: number, cover: string | null): Promise<DocumentDetailDto> {
  return apiFetch<DocumentDetailDto>(`/api/documents/${id}/cover`, {
    method: "PATCH",
    body: JSON.stringify({ cover }),
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

// 메인 화면 최근 수정된 게시글 한 줄 (마지막 수정자·수정 시각 기준)
export interface RecentDocumentDto {
  id: number;
  spaceId: number;
  spaceName: string;
  title: string;
  icon: string | null;
  kind: DocumentKind;
  // 마지막으로 수정한 사람과 시각
  updatedByName: string;
  updatedAt: string;
}

// 최근 수정한 페이지·파일 10개 (수정 시각 최신순)
export function listRecentDocuments(): Promise<RecentDocumentDto[]> {
  return apiFetch<RecentDocumentDto[]>("/api/documents/recent");
}

// 예전 하위 페이지 트리 항목을 본문에 페이지 블록으로 붙일 목록 (문서마다 처음 한 번만 ID 목록, 이후 빈 목록)
export function claimPageBlockBackfill(documentId: number): Promise<number[]> {
  return apiFetch<number[]>(`/api/documents/${documentId}/page-block-backfill`, { method: "POST" });
}
