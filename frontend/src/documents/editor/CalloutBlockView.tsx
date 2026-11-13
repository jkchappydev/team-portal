import { useLayoutEffect, useRef } from "react";
import { UnstyledButton } from "@mantine/core";
import { IconPicker } from "../IconPicker";

interface Props {
  icon: string;
  color: string;
  editable: boolean;
  onChangeIcon: (icon: string) => void;
}

// 아이콘 칸 높이 (index.css .callout-icon-button과 같은 값)
const ICON_BOX = 28;

// 첫 줄 글자 세로 가운데까지의 거리 (콜아웃 상자 안쪽 위 기준, 첫 줄이 없으면 null)
function firstLineCenter(callout: HTMLElement): number | null {
  const firstLine = callout.querySelector<HTMLElement>(":scope > .bn-block-group .bn-inline-content");
  if (!firstLine) return null;
  const style = getComputedStyle(firstLine);
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5;
  const top = firstLine.getBoundingClientRect().top - callout.getBoundingClientRect().top
    - Number.parseFloat(getComputedStyle(callout).paddingTop || "0");
  return top + lineHeight / 2;
}

// 노션 콜아웃 왼쪽 이모지 (눌러서 변경), 첫 줄이 제목처럼 커져도 첫 줄 가운데에 맞춤
// 콜아웃 안의 글은 하위 블록이라 편집기가 아이콘 오른쪽 상자 안에 그림 (index.css .callout-block)
export function CalloutBlockView({ icon, color, editable, onChangeIcon }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // 첫 줄 형식·크기가 바뀔 때마다 아이콘 위치를 다시 맞춤
  useLayoutEffect(() => {
    const iconEl = ref.current;
    const callout = iconEl?.closest<HTMLElement>(".bn-block");
    if (!iconEl || !callout) return;
    const align = () => {
      const center = firstLineCenter(callout);
      iconEl.style.marginTop = center === null ? "" : `${Math.max(0, center - ICON_BOX / 2)}px`;
    };
    align();
    const group = callout.querySelector(":scope > .bn-block-group");
    const mutations = new MutationObserver(align);
    if (group) mutations.observe(group, { childList: true, subtree: true, attributes: true, characterData: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(align);
    resize?.observe(callout);
    return () => {
      mutations.disconnect();
      resize?.disconnect();
    };
  }, []);

  const iconView = <span aria-hidden>{icon}</span>;
  return (
    <div ref={ref} className="callout-icon" data-callout-color={color} contentEditable={false}>
      {editable ? (
        <IconPicker
          hasIcon={false}
          // 제거를 고르면 기본 💡로 되돌림
          onSelect={(next) => onChangeIcon(next ?? "💡")}
          target={(toggle) => (
            <UnstyledButton aria-label="콜아웃 아이콘 변경" onClick={toggle} className="callout-icon-button">
              {iconView}
            </UnstyledButton>
          )}
        />
      ) : <span className="callout-icon-button">{iconView}</span>}
    </div>
  );
}
