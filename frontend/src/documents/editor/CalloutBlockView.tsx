import { useLayoutEffect, useRef } from "react";
import { UnstyledButton } from "@mantine/core";
import { IconPicker } from "../IconPicker";
import { firstLineCenter } from "./firstLine";

interface Props {
  icon: string;
  color: string;
  editable: boolean;
  onChangeIcon: (icon: string) => void;
  // 본문이 바뀔 때마다 부르는 구독 함수 (해제 함수를 돌려줌)
  onDocumentChange: (callback: () => void) => () => void;
}

// 아이콘 칸 높이 (index.css .callout-icon-button과 같은 값)
const ICON_BOX = 28;
// 제목 크기가 바뀌는 효과(0.2초)가 끝난 뒤 한 번 더 맞춤
const AFTER_TRANSITION_MS = 250;

// 노션 콜아웃 왼쪽 이모지 (눌러서 변경), 첫 줄이 제목처럼 커져도 첫 줄 가운데에 맞춤
// 콜아웃 안의 글은 하위 블록이라 편집기가 아이콘 오른쪽 상자 안에 그림 (index.css .callout-block)
export function CalloutBlockView({ icon, color, editable, onChangeIcon, onDocumentChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // 그릴 때마다 DOM을 새로 찾아 맞춤 (편집기가 블록 DOM을 다시 만들어도 이전 요소를 붙잡지 않음)
  useLayoutEffect(() => {
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const align = () => {
      const iconEl = ref.current;
      const callout = iconEl?.closest<HTMLElement>(".bn-block");
      if (!iconEl || !callout) return;
      const group = callout.querySelector<HTMLElement>(":scope > .bn-block-group");
      const center = group ? firstLineCenter(group, callout) : null;
      iconEl.style.marginTop = center === null ? "" : `${Math.max(0, center - ICON_BOX / 2)}px`;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(align);
      clearTimeout(timer);
      timer = setTimeout(align, AFTER_TRANSITION_MS);
    };
    schedule();
    const unsubscribe = onDocumentChange(schedule);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("resize", schedule);
    };
  }, [onDocumentChange]);

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
