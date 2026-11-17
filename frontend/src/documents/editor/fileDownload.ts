// 본문 파일·이미지 블록의 "다운로드" 버튼: 새 탭에 열지 않고 브라우저 다운로드로 바로 저장

const ATTACHMENT_PREFIX = "/api/attachments/";

// 우리 서버 첨부면 이미지도 attachment로 내려받는 주소 (그 외 주소는 null)
export function attachmentDownloadUrl(url: string, origin: string = window.location.origin): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url, origin);
  } catch {
    return null;
  }
  if (parsed.origin !== origin || !parsed.pathname.startsWith(ATTACHMENT_PREFIX)) return null;
  parsed.searchParams.set("download", "true");
  return parsed.pathname + parsed.search;
}

// 외부 주소 파일 이름: 블록 이름이 있으면 그 이름, 없으면 주소 마지막 부분
export function downloadName(url: string, name?: string): string {
  if (name && name.trim()) return name.trim();
  try {
    const last = new URL(url, window.location.origin).pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "download";
  } catch {
    return "download";
  }
}

// a 태그 클릭으로 저장 (download 속성은 같은 출처 주소나 blob 주소에서만 동작)
function clickDownload(href: string, name?: string) {
  const link = document.createElement("a");
  link.href = href;
  if (name !== undefined) link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// 우리 첨부는 서버가 원래 파일 이름(한글 포함)으로 내려 주고, 외부 주소는 받아서 저장
// 외부 서버가 막아(CORS) 받을 수 없으면 기존처럼 새 탭으로 열기
export async function downloadFile(url: string, name?: string): Promise<void> {
  const attachment = attachmentDownloadUrl(url);
  if (attachment) {
    clickDownload(attachment, "");
    return;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`다운로드 실패: ${res.status}`);
    const objectUrl = URL.createObjectURL(await res.blob());
    clickDownload(objectUrl, downloadName(url, name));
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
