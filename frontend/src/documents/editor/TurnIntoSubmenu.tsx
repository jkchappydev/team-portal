import { useComponentsContext, usePortalElement } from "@blocknote/react";
import { MenuIcon } from "./MenuIcon";
import { MENU_ICONS } from "./menuIcons";
import { TURN_INTO_OPTIONS } from "./blockTurnInto";
import type { TurnIntoKey } from "./blockTurnInto";

interface TurnIntoSubmenuProps {
  // 지금 블록 종류 (체크 표시, 목록에 없는 종류면 null)
  current: TurnIntoKey | null;
  onSelect: (key: TurnIntoKey) => void;
}

// 노션식 "전환 >" 하위 메뉴: 글 블록을 다른 글 종류로 바꿈 (이름은 슬래시 메뉴와 같은 문구)
export function TurnIntoSubmenu({ current, onSelect }: TurnIntoSubmenuProps) {
  const Components = useComponentsContext()!;
  // 하위 메뉴를 편집기와 같은 위치에 띄우기 위한 요소
  const portalElement = usePortalElement();

  return (
    <Components.Generic.Menu.Root position="right" sub portalElement={portalElement}>
      <Components.Generic.Menu.Trigger sub>
        <Components.Generic.Menu.Item className="bn-menu-item" subTrigger icon={<MenuIcon d={MENU_ICONS.turnInto} />}>
          전환
        </Components.Generic.Menu.Item>
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown sub className="bn-menu-dropdown">
        {TURN_INTO_OPTIONS.map((option) => (
          <Components.Generic.Menu.Item
            key={option.key}
            className="bn-menu-item"
            checked={current === option.key}
            onClick={() => onSelect(option.key)}
          >
            {option.label}
          </Components.Generic.Menu.Item>
        ))}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}
