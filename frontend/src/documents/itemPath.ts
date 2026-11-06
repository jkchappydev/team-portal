import type { DocumentKind } from "../api/documents";

// 트리 항목 종류별 화면 주소 (파일은 미리보기, WBS는 일정표, 페이지는 편집 화면)
export function itemPath(kind: DocumentKind, id: number): string {
  if (kind === "FILE") return `/files/${id}`;
  if (kind === "WBS") return `/wbs/${id}`;
  return `/documents/${id}`;
}

// 화면 주소에서 열려 있는 트리 항목 ID (페이지·파일·WBS 화면이 아니면 null)
export function itemIdOfPath(pathname: string): number | null {
  const match = pathname.match(/^\/(?:documents|files|wbs)\/(\d+)/);
  return match ? Number(match[1]) : null;
}
