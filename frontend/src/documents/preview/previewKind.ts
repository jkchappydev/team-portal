// 파일 미리보기 방식 (none: 미리보기 미지원, 다운로드만)
export type PreviewKind = "docx" | "xlsx" | "pdf" | "image" | "text" | "none";

// 파일 이름 확장자로 미리보기 방식 결정
export function previewKindOf(fileName: string): PreviewKind {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (ext === "pdf") return "pdf";
  // SVG는 스크립트를 품을 수 있어 미리보기에서 제외
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (["txt", "csv", "md", "log", "json"].includes(ext)) return "text";
  return "none";
}

// 텍스트 파일은 UTF-8로 읽고, 깨지면 엑셀에서 저장한 한글 CSV처럼 EUC-KR로 다시 읽음
export function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("euc-kr").decode(buffer);
  }
}
