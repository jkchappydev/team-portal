// 서버 시각(ISO)을 로컬 "YYYY-MM-DD HH:mm"으로 표시
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 서버 시각(ISO)을 로컬 날짜 "YYYY-MM-DD"로 표시
export function formatDate(iso: string | null | undefined): string {
  const dateTime = formatDateTime(iso);
  return dateTime === "-" ? "-" : dateTime.slice(0, 10);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
