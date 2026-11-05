// BlockNote가 협업 본문을 저장하는 Yjs 조각 이름 (collab 서버 텍스트 추출과 동일)
export const FRAGMENT_NAME = "document-store";

// 협업 서버 주소 (페이지와 같은 호스트의 /collab, https면 wss)
export function collabUrl(): string {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.host}/collab`;
}
