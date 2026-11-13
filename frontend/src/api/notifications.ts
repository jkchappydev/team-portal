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

export type WorkStatusNoticeAction = "CREATED" | "UPDATED" | "DELETED";

// 근무 상황 변경 알림 한 건 (label: 바뀐 뒤 표기, 삭제면 지운 항목 표기)
export interface WorkStatusNoticeDto {
  id: number;
  action: WorkStatusNoticeAction;
  label: string;
  startDate: string;
  endDate: string;
  actorName: string;
  createdAt: string;
}

// enabled: 알림을 받는 팀원(팀장 이상·개발자)인지
export interface WorkStatusNoticeListDto {
  enabled: boolean;
  items: WorkStatusNoticeDto[];
}

// 다른 팀원이 바꾼 근무 상황 중 아직 확인하지 않은 것 (최근순)
export function listWorkStatusNotices(): Promise<WorkStatusNoticeListDto> {
  return apiFetch<WorkStatusNoticeListDto>("/api/notifications/work-status");
}

export function markWorkStatusNoticeRead(id: number): Promise<void> {
  return apiFetch<void>(`/api/notifications/work-status/${id}/read`, { method: "POST" });
}

export function markAllWorkStatusNoticesRead(): Promise<void> {
  return apiFetch<void>("/api/notifications/work-status/read-all", { method: "POST" });
}
