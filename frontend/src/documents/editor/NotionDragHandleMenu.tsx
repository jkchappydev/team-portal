import type { ReactNode } from "react";
import { Switch, UnstyledButton } from "@mantine/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { DragHandleMenu, useBlockNoteEditor, useComponentsContext, useExtensionState, usePortalElement } from "@blocknote/react";
import { BLOCK_COLORS, colorTableCells, tableColor, withoutIds } from "./blockMenu";
import type { ColorKind, TableContent } from "./blockMenu";

// 메뉴 아이콘 (글자색을 따라가는 얇은 선)
function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  headerRow: "M2.5 3.5h11v9h-11zM2.5 6.5h11",
  headerColumn: "M2.5 3.5h11v9h-11zM6 3.5v9",
  color: "M8 2.5 3.5 13.5M8 2.5l4.5 11M5 10h6",
  above: "M8 13V3M4 7l4-4 4 4",
  below: "M8 3v10M4 9l4 4 4-4",
  copy: "M5.5 5.5h8v8h-8zM2.5 10.5v-8h8",
  trash: "M2.5 4h11M6 4V2.75h4V4M3.75 4l.7 9.25h7.1l.7-9.25",
};

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
  // 하위 메뉴(색)를 편집기와 같은 위치에 띄우기 위한 요소
  const portalElement = usePortalElement();
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

  const colorItems = (kind: ColorKind) =>
    BLOCK_COLORS.map((color) => (
      <Components.Generic.Menu.Item
        key={`${kind}-${color.value}`}
        className="bn-menu-item"
        checked={currentColor(kind) === color.value}
        icon={kind === "textColor"
          ? <span className="color-swatch" data-text-color={color.value}>A</span>
          : <span className="color-swatch" data-background-color={color.value} />}
        onClick={() => setColor(kind, color.value)}
      >
        {color.label} {kind === "textColor" ? "텍스트" : "배경"}
      </Components.Generic.Menu.Item>
    ));

  return (
    <DragHandleMenu>
      {/* 메뉴 항목은 누르면 메뉴가 닫히므로, 노션처럼 켜고 꺼도 열려 있도록 스위치 줄은 일반 버튼으로 둠 */}
      {tableContent && (
        <>
          <MenuToggle
            label="제목 행"
            icon={<Icon d={ICONS.headerRow} />}
            checked={!!tableContent.headerRows}
            onToggle={() => toggleHeader("headerRows")}
          />
          <MenuToggle
            label="제목 열"
            icon={<Icon d={ICONS.headerColumn} />}
            checked={!!tableContent.headerCols}
            onToggle={() => toggleHeader("headerCols")}
          />
        </>
      )}
      {(supports("textColor") || supports("backgroundColor")) && (
        <Components.Generic.Menu.Root position="right" sub portalElement={portalElement}>
          <Components.Generic.Menu.Trigger sub>
            <Components.Generic.Menu.Item className="bn-menu-item" subTrigger icon={<Icon d={ICONS.color} />}>
              색
            </Components.Generic.Menu.Item>
          </Components.Generic.Menu.Trigger>
          <Components.Generic.Menu.Dropdown sub className="bn-menu-dropdown notion-color-menu">
            {supports("textColor") && (
              <>
                <Components.Generic.Menu.Label>텍스트 색상</Components.Generic.Menu.Label>
                {colorItems("textColor")}
              </>
            )}
            {supports("backgroundColor") && (
              <>
                <Components.Generic.Menu.Label>배경 색상</Components.Generic.Menu.Label>
                {colorItems("backgroundColor")}
              </>
            )}
          </Components.Generic.Menu.Dropdown>
        </Components.Generic.Menu.Root>
      )}
      <Components.Generic.Menu.Item className="bn-menu-item" icon={<Icon d={ICONS.above} />} onClick={() => insert("before")}>
        위에 삽입
      </Components.Generic.Menu.Item>
      <Components.Generic.Menu.Item className="bn-menu-item" icon={<Icon d={ICONS.below} />} onClick={() => insert("after")}>
        아래에 삽입
      </Components.Generic.Menu.Item>
      <Components.Generic.Menu.Item className="bn-menu-item" icon={<Icon d={ICONS.copy} />} onClick={duplicate}>
        복제
      </Components.Generic.Menu.Item>
      <Components.Generic.Menu.Item className="bn-menu-item" icon={<Icon d={ICONS.trash} />} onClick={() => editor.removeBlocks([block])}>
        삭제
      </Components.Generic.Menu.Item>
    </DragHandleMenu>
  );
}
