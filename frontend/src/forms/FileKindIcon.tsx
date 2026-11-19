import { fileKindOf, type FileKind } from "./formFile";

// 종류별 선 모양 (20×20, 글자색을 따라가는 얇은 선)
const PATHS: Record<FileKind, string> = {
  // 오른쪽 위가 접힌 종이
  document: "M5 2.5h6.5L15.5 6.5V17a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z M11.5 2.5v4h4 M7.5 10.5h5 M7.5 13.5h5",
  // 액자 속 산과 해
  image: "M3.5 4.5h13v11h-13Z M3.5 13l4-4 3.5 3.5 2-2 3.5 3.5 M12.5 7.5h.01",
  // 지퍼가 달린 종이
  archive: "M5 2.5h6.5L15.5 6.5V17a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z M9 2.5v1.5 M9 5.5v1.5 M9 8.5v1.5 M8 11.5h2v3H8Z",
  // 제목 표시줄이 있는 창
  app: "M3 4.5h14v11H3Z M3 7.5h14 M5.5 6h.01 M7.5 6h.01 M7 10.5l2 1.5-2 1.5 M10.5 13.5h2.5",
  // 재생 단추
  media: "M3.5 4.5h13v11h-13Z M8.5 7.5v5l4-2.5Z",
};

// 파일 이름 확장자에 맞는 아이콘
export function FileKindIcon({ fileName }: { fileName: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor"
      strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[fileKindOf(fileName)]} />
    </svg>
  );
}
