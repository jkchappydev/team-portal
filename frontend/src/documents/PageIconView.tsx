import type { CSSProperties } from "react";
import { FileLineIcon, PageLineIcon, ScheduleLineIcon } from "./DefaultIcons";
import { DEFAULT_PROJECT_COVER, iconImageSrc } from "./pageIcon";

type Fallback = "page" | "project" | "file" | "schedule";

interface Props {
  icon: string | null | undefined;
  // 이미지 아이콘 크기 (기본은 주변 글자 크기)
  size?: number | string;
  // 프로젝트(또는 프로젝트 본문)면 아이콘이 없을 때 폴더 아이콘
  project?: boolean;
  // 아이콘이 없을 때 보일 선 아이콘 (project보다 우선)
  fallback?: Fallback;
}

const FALLBACK_ICONS = {
  page: PageLineIcon,
  file: FileLineIcon,
  schedule: ScheduleLineIcon,
};

// 페이지 아이콘 표시: 이모지는 글자로, 업로드 이미지·이미지 주소는 글자 크기에 맞춘 그림으로, 없으면 선 아이콘(프로젝트는 폴더 그림)
export function PageIcon({ icon, size = "1em", project = false, fallback }: Props) {
  const kind = fallback ?? (project ? "project" : "page");
  // 프로젝트는 메인 프로젝트 카드와 같은 폴더 그림, 나머지는 선 아이콘
  if (!icon && kind !== "project") {
    const Fallback = FALLBACK_ICONS[kind];
    return <Fallback size={size} />;
  }
  const src = icon ? iconImageSrc(icon) : DEFAULT_PROJECT_COVER;
  if (!src) return <span aria-hidden>{icon}</span>;
  return (
    <img
      className={icon ? undefined : "default-project-icon"}
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      referrerPolicy="no-referrer"
      // 폴더 그림은 잘리지 않게 (크기는 CSS가 사이드바 16px로 맞춤)
      style={icon
        ? { width: size, height: size, objectFit: "cover", borderRadius: 3, verticalAlign: "-0.125em", display: "inline-block" }
        : { "--icon-size": typeof size === "number" ? `${size}px` : size } as CSSProperties}
    />
  );
}
