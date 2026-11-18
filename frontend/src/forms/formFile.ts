// 확장자별 목록 아이콘 (한글·워드·엑셀·파워포인트·PDF·이미지·압축, 그 외는 일반 문서)
export function fileIconOf(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["hwp", "hwpx"].includes(ext)) return "📝";
  if (["doc", "docx"].includes(ext)) return "📘";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📗";
  if (["ppt", "pptx"].includes(ext)) return "📙";
  if (ext === "pdf") return "📕";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "🖼️";
  if (["zip", "7z", "rar"].includes(ext)) return "🗜️";
  return "📄";
}

// 파일 크기를 B·KB·MB로 (KB 이상은 소수 첫째 자리까지, .0은 생략)
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${Number(value.toFixed(1))}${units[unit]}`;
}
