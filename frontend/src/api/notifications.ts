import { apiFetch } from "./client";
import type { DocumentSummaryDto } from "./documents";

// 다른 팀원이 수정했고 내가 아직 확인하지 않은 페이지 (최근 수정순)
export function listDocumentUpdates(): Promise<DocumentSummaryDto[]> {
  return apiFetch<DocumentSummaryDto[]>("/api/notifications/document-updates");
}

export function markDocumentRead(id: number): Promise<void> {
  return apiFetch<void>(`/api/documents/${id}/read`, { method: "POST" });
}

export function markAllDocumentUpdatesRead(): Promise<void> {
  return apiFetch<void>("/api/notifications/document-updates/read-all", { method: "POST" });
}
