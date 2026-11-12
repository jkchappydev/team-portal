import { useComponentsContext, usePortalElement } from "@blocknote/react";
import { BLOCK_COLORS } from "./blockMenu";
import type { ColorKind } from "./blockMenu";
import { MenuIcon } from "./MenuIcon";
import { MENU_ICONS } from "./menuIcons";

interface ColorSubmenuProps {
  // 메뉴에 보일 색 종류 (글자색·배경색)
  kinds: ColorKind[];
  // 지금 색 (체크 표시용, 여러 색이 섞여 있으면 undefined)
  current: (kind: ColorKind) => string | undefined;
  onSelect: (kind: ColorKind, color: string) => void;
}

// 노션식 "색 >" 하위 메뉴: 텍스트 색상·배경 색상 목록 (블록 메뉴와 표 칸 메뉴가 함께 씀)
export function ColorSubmenu({ kinds, current, onSelect }: ColorSubmenuProps) {
  const Components = useComponentsContext()!;
  // 하위 메뉴를 편집기와 같은 위치에 띄우기 위한 요소
  const portalElement = usePortalElement();
  if (kinds.length === 0) return null;

  const items = (kind: ColorKind) =>
    BLOCK_COLORS.map((color) => (
      <Components.Generic.Menu.Item
        key={`${kind}-${color.value}`}
        className="bn-menu-item"
        checked={current(kind) === color.value}
        icon={kind === "textColor"
          ? <span className="color-swatch" data-text-color={color.value}>A</span>
          : <span className="color-swatch" data-background-color={color.value} />}
        onClick={() => onSelect(kind, color.value)}
      >
        {color.label} {kind === "textColor" ? "텍스트" : "배경"}
      </Components.Generic.Menu.Item>
    ));

  return (
    <Components.Generic.Menu.Root position="right" sub portalElement={portalElement}>
      <Components.Generic.Menu.Trigger sub>
        <Components.Generic.Menu.Item className="bn-menu-item" subTrigger icon={<MenuIcon d={MENU_ICONS.color} />}>
          색
        </Components.Generic.Menu.Item>
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown sub className="bn-menu-dropdown notion-color-menu">
        {kinds.includes("textColor") && (
          <>
            <Components.Generic.Menu.Label>텍스트 색상</Components.Generic.Menu.Label>
            {items("textColor")}
          </>
        )}
        {kinds.includes("backgroundColor") && (
          <>
            <Components.Generic.Menu.Label>배경 색상</Components.Generic.Menu.Label>
            {items("backgroundColor")}
          </>
        )}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}
