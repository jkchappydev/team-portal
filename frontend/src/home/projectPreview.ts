import type { SpaceDto } from "../api/spaces";
import { DEFAULT_PROJECT_COVER, iconImageSrc } from "../documents/pageIcon";

export { DEFAULT_PROJECT_COVER };

// 메인 화면 프로젝트 카드 윗부분: 프로젝트 아이콘(이모지·이미지) 또는 기본 폴더 그림
export type ProjectPreview =
  | { kind: "emoji"; emoji: string }
  | { kind: "image"; src: string }
  | { kind: "folder"; src: string };

// 메인 화면에 보이는 프로젝트 카드 수 (사이드바 순서 상위)
export const GALLERY_LIMIT = 10;

// 사이드바와 같은 프로젝트 아이콘을 크게, 아이콘이 없으면 폴더 그림
export function projectPreview(space: Pick<SpaceDto, "icon">): ProjectPreview {
  if (!space.icon) return { kind: "folder", src: DEFAULT_PROJECT_COVER };
  const image = iconImageSrc(space.icon);
  return image ? { kind: "image", src: image } : { kind: "emoji", emoji: space.icon };
}
