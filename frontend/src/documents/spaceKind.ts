import type { SpaceKind } from "../api/spaces";

// 사이드바 최상위 항목을 화면에서 부르는 이름 (프로젝트 또는 페이지)
export function spaceLabel(kind: SpaceKind | null | undefined): string {
  return kind === "PAGE" ? "페이지" : "프로젝트";
}
