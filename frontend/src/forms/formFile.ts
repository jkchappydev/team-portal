export type FileKind = "document" | "image" | "archive" | "app" | "media";

// 확장자별 아이콘 종류 (문서는 모두 같은 아이콘, 압축·실행 파일·이미지·영상/음악만 따로 구분)
export function fileKindOf(fileName: string): FileKind {
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "heic"].includes(ext)) return "image";
  if (["zip", "7z", "rar", "tar", "gz", "tgz", "bz2", "xz", "alz", "egg"].includes(ext)) return "archive";
  if (["exe", "msi", "bat", "cmd", "apk", "dmg", "pkg", "app", "jar", "sh", "appx", "msix"].includes(ext)) return "app";
  if (["mp4", "mov", "avi", "mkv", "webm", "wmv", "mp3", "wav", "m4a", "flac", "aac", "ogg"].includes(ext)) return "media";
  return "document";
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
