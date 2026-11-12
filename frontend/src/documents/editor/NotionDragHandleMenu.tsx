import type { ReactNode } from "react";
import { Switch, UnstyledButton } from "@mantine/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { DragHandleMenu, useBlockNoteEditor, useComponentsContext, useExtensionState } from "@blocknote/react";
import { colorTableCells, tableColor, withoutIds } from "./blockMenu";
import { ColorSubmenu } from "./ColorSubmenu";
import { MenuIcon } from "./MenuIcon";
import { MENU_ICONS } from "./menuIcons";
import type { ColorKind, TableContent } from "./blockMenu";

interface MenuToggleProps {
  label: string;
  icon: ReactNode;
  checked: boolean;
  onToggle: () => void;
}

// 메뉴 안의 켜고 끄는 줄: 눌러도 메뉴를 닫지 않음
export function MenuToggle({ label, icon, checked, onToggle }: MenuToggleProps) {
  return (
    <UnstyledButton
      className="menu-toggle-row"
      role="menuitemcheckbox"
      aria-label={label}
      aria-checked={checked}
      onClick={(e) => {
        // 메뉴 바깥 클릭으로 처리되어 닫히지 않도록 이벤트를 여기서 멈춤
        e.stopPropagation();
        onToggle();
      }}
    >
      <span className="menu-toggle-icon">{icon}</span>
      <span className="menu-toggle-label">{label}</span>
      <Switch size="xs" checked={checked} readOnly tabIndex={-1} aria-hidden />
    </UnstyledButton>
  );
}

// 노션처럼 블록 손잡이(⠿)를 누르면 나오는 메뉴: 표 제목 행·열, 색, 위·아래 삽입, 복제, 삭제
export function NotionDragHandleMenu() {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, { editor, selector: (state) => state?.block });
  if (!block) return null;

  const isTable = block.type === "table";
  const tableContent = isTable ? (block.content as unknown as TableContent) : null;
  const props = block.props as Record<string, unknown>;

  // 표는 전체 칸에, 그 외 블록은 블록 자체에 색 적용 (색 속성이 없는 블록은 메뉴에서 뺌)
  const supports = (kind: ColorKind) => (tableContent ? true : kind in props);
  const currentColor = (kind: ColorKind) =>
    tableContent ? tableColor(tableContent, kind) : ((props[kind] as string | undefined) ?? "default");
  const setColor = (kind: ColorKind, color: string) => {
    if (tableContent) {
      editor.updateBlock(block, { content: colorTableCells(tableContent, kind, color) as never });
    } else {
      editor.updateBlock(block, { props: { [kind]: color } as never });
    }
  };

  const toggleHeader = (key: "headerRows" | "headerCols") => {
    if (!tableContent) return;
    editor.updateBlock(block, { content: { ...tableContent, [key]: tableContent[key] ? undefined : 1 } as never });
  };

  const insert = (placement: "before" | "after") => {
    const [inserted] = editor.insertBlocks([{ type: "paragraph" }], block, placement);
    editor.setTextCursorPosition(inserted, "start");
    editor.focus();
  };

  const duplicate = () => {
    editor.insertBlocks([withoutIds(block) as never], block, "after");
  };

  return (
    <DragHandleMenu>
      {/* 메뉴 항목은 누르면 메뉴가 닫히므로, 노션처럼 켜고 꺼도 열려 있도록 스위치 줄은 일반 버튼으로 둠 */}
      {tableContent && (
        <>
          <MenuToggle
            label="제목 행"
            icon={<MenuIcon d={MENU_ICONS.headerRow} />}
            checked={!!tableContent.headerRows}
            onToggle={() => toggleHeader("headerRows")}
          />
          <MenuToggle
            label="제목 열"
            icon={<MenuIcon d={MENU_ICONS.headerColumn} />}
            checked={!!tableContent.headerCols}
            onToggle={() => toggleHeader("headerCols")}
          />
        </>
      )}
      <ColorSubmenu
        kinds={(["textColor", "backgroundColor"] as const).filter(supports)}
        current={currentColor}
        onSelect={setColor}
      />
      <Components.Generic.Menu.Item className="bn-menu-item" icon={<MenuIcon d={MENU_ICONS.above} />} onClick={() => insert("before")}>
        위에 삽입
      </Components.Generic.Menu.Item>
      <Components.Generic.Menu.Item className="bn-menu-item" icon={<MenuIcon d={MENU_ICONS.below} />} onClick={() => insert("after")}>
        아래에 삽입
      </Components.Generic.Menu.Item>
      <Components.Generic.Menu.Item className="bn-menu-item" icon={<MenuIcon d={MENU_ICONS.copy} />} onClick={duplicate}>
        복제
      </Components.Generic.Menu.Item>
      <Components.Generic.Menu.Item className="bn-menu-item" icon={<MenuIcon d={MENU_ICONS.trash} />} onClick={() => editor.removeBlocks([block])}>
        삭제
      </Components.Generic.Menu.Item>
    </DragHandleMenu>
  );
}
