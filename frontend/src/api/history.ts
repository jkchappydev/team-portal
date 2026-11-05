import { apiFetch } from "./client";

// AUTO: 10분 간격 자동 사본, BEFORE_RESTORE: 되돌리기 직전 본문
export type HistoryReason = "AUTO" | "BEFORE_RESTORE";

export interface HistoryEntryDto {
  id: number;
  createdAt: string;
  // 기능 추가 전 사본은 수정자 기록이 없어 null
  createdByName: string | null;
  reason: HistoryReason;
}

export interface HistoryVersionDto extends HistoryEntryDto {
  // Yjs 본문 상태 (Base64)
  contentState: string;
}

export function listHistory(documentId: number): Promise<HistoryEntryDto[]> {
  return apiFetch<HistoryEntryDto[]>(`/api/documents/${documentId}/history`);
}

export function getHistoryVersion(documentId: number, snapshotId: number): Promise<HistoryVersionDto> {
  return apiFetch<HistoryVersionDto>(`/api/documents/${documentId}/history/${snapshotId}`);
}

export function saveHistoryCheckpoint(documentId: number, contentState: string): Promise<HistoryEntryDto> {
  return apiFetch<HistoryEntryDto>(`/api/documents/${documentId}/history`, {
    method: "POST",
    body: JSON.stringify({ contentState }),
  });
}
