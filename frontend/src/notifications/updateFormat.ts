import type { DocumentSummaryDto } from "../api/documents";
import type { SpaceDto } from "../api/spaces";
import { itemPath } from "../documents/itemPath";

// 수정 시각을 "N분 전"처럼 짧게 표시
export function formatRelative(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

// 프로젝트 본문 페이지인지 (목록에서 프로젝트 아이콘·주소로 보여 줄 때)
export function isProjectHome(doc: Pick<DocumentSummaryDto, "id" | "kind">, spaces: SpaceDto[]): boolean {
  return doc.kind === "PAGE" && spaces.some((s) => s.homeDocumentId === doc.id);
}

// 최상위 페이지 본문은 /spaces, 그 외는 종류별 화면 (파일은 미리보기, WBS는 일정표)
export function updatePath(doc: Pick<DocumentSummaryDto, "id" | "kind" | "spaceId">, spaces: SpaceDto[]): string {
  if (isProjectHome(doc, spaces)) return `/spaces/${doc.spaceId}`;
  return itemPath(doc.kind, doc.id);
}
