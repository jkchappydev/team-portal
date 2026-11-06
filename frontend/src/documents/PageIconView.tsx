import { iconImageSrc, pageIcon } from "./pageIcon";

interface Props {
  icon: string | null | undefined;
  // 이미지 아이콘 크기 (기본은 주변 글자 크기)
  size?: number | string;
}

// 페이지 아이콘 표시: 이모지는 글자로, 업로드 이미지·이미지 주소는 글자 크기에 맞춘 그림으로
export function PageIcon({ icon, size = "1em" }: Props) {
  const src = iconImageSrc(icon);
  if (!src) return <span aria-hidden>{pageIcon(icon)}</span>;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      referrerPolicy="no-referrer"
      style={{ width: size, height: size, objectFit: "cover", borderRadius: 3, verticalAlign: "-0.125em", display: "inline-block" }}
    />
  );
}
