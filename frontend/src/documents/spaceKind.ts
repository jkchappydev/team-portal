import type { SpaceDto, SpaceKind, SpaceSection } from "../api/spaces";

// 사이드바 최상위 항목을 화면에서 부르는 이름 (프로젝트 또는 페이지)
export function spaceLabel(kind: SpaceKind | null | undefined): string {
  return kind === "PAGE" ? "페이지" : "프로젝트";
}

// 사이드바·메인 화면에 나눠 보이는 칸 (위에서부터 이 순서)
export const SPACE_SECTIONS: { value: SpaceSection; label: string }[] = [
  { value: "INTERNAL", label: "내부 프로젝트" },
  { value: "EXTERNAL", label: "외부 프로젝트" },
];

// 구분 값이 없는 예전 응답은 내부 프로젝트로 봄
export function sectionOf(space: Pick<SpaceDto, "section">): SpaceSection {
  return space.section ?? "INTERNAL";
}

// 끌어 옮긴 항목을 section 칸의 index 위치에 넣은 전체 목록 (칸 순서대로 이어 붙임, 화면을 먼저 바꿀 때 사용)
export function moveToSection(spaces: SpaceDto[], id: number, index: number, section: SpaceSection): SpaceDto[] {
  const moving = spaces.find((space) => space.id === id);
  if (!moving) return spaces;
  const others = spaces.filter((space) => space.id !== id);
  return SPACE_SECTIONS.flatMap(({ value }) => {
    const inSection = others.filter((space) => sectionOf(space) === value);
    if (value === section) inSection.splice(Math.min(Math.max(index, 0), inSection.length), 0, { ...moving, section });
    return inSection;
  });
}
