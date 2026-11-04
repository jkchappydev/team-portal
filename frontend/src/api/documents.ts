import { apiFetch } from "./client";

export interface DocumentSummaryDto {
  id: number;
  spaceId: number;
  spaceName: string | null;
  title: string;
  updatedByName: string | null;
  updatedAt: string;
}

export interface DocumentDetailDto {
  id: number;
  spaceId: number;
  spaceName: string | null;
  title: string;
  createdByName: string | null;
  updatedByName: string | null;
  updatedAt: string;
}

export interface TrashItemDto {
  id: number;
  name: string;
  deletedAt: string;
}

export interface TrashDto {
  spaces: TrashItemDto[];
  documents: TrashItemDto[];
}

export function listDocuments(spaceId: number): Promise<DocumentSummaryDto[]> {
  return apiFetch<DocumentSummaryDto[]>(`/api/spaces/${spaceId}/documents`);
}

export function createDocument(spaceId: number, title?: string): Promise<DocumentSummaryDto> {
  return apiFetch<DocumentSummaryDto>(`/api/spaces/${spaceId}/documents`, {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
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
