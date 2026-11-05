import type { DocumentSummaryDto } from "../api/documents";
import type { SpaceDto } from "../api/spaces";

// 수정 시각을 "N분 전"처럼 짧게 표시
export function formatRelative(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

// 최상위 페이지 본문은 /spaces, 파일은 미리보기, 그 외 페이지는 편집 화면
export function updatePath(doc: DocumentSummaryDto, spaces: SpaceDto[]): string {
  if (doc.kind === "FILE") return `/files/${doc.id}`;
  if (spaces.some((s) => s.homeDocumentId === doc.id)) return `/spaces/${doc.spaceId}`;
  return `/documents/${doc.id}`;
}
