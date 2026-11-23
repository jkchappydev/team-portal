import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { isDeleteKey, markMenuBlock } from "./menuSelection";
import { Switch, UnstyledButton } from "@mantine/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { DragHandleMenu, useBlockNoteEditor, useComponentsContext, useExtensionState } from "@blocknote/react";
import { ApiError } from "../../api/client";
import { colorTableCells, tableColor, withoutIds } from "./blockMenu";
import { copyBlockWithPages, referencedPageIds } from "./pageCommand";
import { usePageCopy } from "./pageCopyContext";
import { copyBlocks } from "./blockMarquee";
import { clearPageCut } from "./pagePaste";
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

// 메뉴가 열려 있는 동안만 그려짐: 블록 전체 선택 표시, Delete·Backspace로 블록 삭제 후 메뉴 닫기
function MenuBlockSelection({ blockId, onDelete }: { blockId: string; onDelete: () => void }) {
  const deleteRef = useRef(onDelete);
  deleteRef.current = onDelete;
  useEffect(() => markMenuBlock(blockId), [blockId]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isDeleteKey(e)) return;
      // 메뉴 안 입력 칸(있다면)에서는 글자 지우기로 둠
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      e.stopPropagation();
      // 포커스된 메뉴에 Esc를 보내 노션처럼 메뉴를 닫은 뒤 블록 삭제
      (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      deleteRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
  return null;
}

// 노션처럼 블록 손잡이(⠿)를 누르면 나오는 메뉴: 표 제목 행·열, 색, 위·아래 삽입, 복제, 삭제
// 열려 있는 동안 블록 전체를 선택 표시하고 Delete로 삭제
export function NotionDragHandleMenu() {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, { editor, selector: (state) => state?.block });
  const pageCopy = usePageCopy();
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

  // 페이지 블록(하위 블록 안 포함)은 페이지 사본을 만든 뒤 사본을 가리키는 블록으로 넣음
  const duplicate = () => {
    if (!pageCopy || referencedPageIds([block as never]).size === 0) {
      editor.insertBlocks([withoutIds(block) as never], block, "after");
      return;
    }
    copyBlockWithPages(block as never, pageCopy.copyPage)
      .then((copy) => {
        // 사본을 만드는 사이 원래 블록이 지워졌으면 맨 끝에 넣음
        const anchor = editor.getBlock(block.id) ?? editor.document[editor.document.length - 1];
        editor.insertBlocks([copy as never], anchor, "after");
      })
      .catch((error: unknown) =>
        pageCopy.onError(error instanceof ApiError && error.message ? error.message : "페이지를 복제하지 못했습니다."));
  };

  // 블록을 클립보드에 담음 (고른 블록 Ctrl+C와 같은 방식, 잘라내기 기록은 지움)
  const copy = () => {
    copyBlocks(editor, [block.id]);
    clearPageCut();
  };

  const remove = () => editor.removeBlocks([block]);

  return (
    <DragHandleMenu>
      <MenuBlockSelection blockId={block.id} onDelete={remove} />
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
      {/* 복사: 클립보드에 담기만 함 (Ctrl+C와 같음, 페이지 블록은 붙여넣은 곳에 원래 제목의 사본), 복제: 바로 아래에 "(사본)" */}
      <Components.Generic.Menu.Item className="bn-menu-item" icon={<MenuIcon d={MENU_ICONS.clipboard} />} onClick={copy}>
        <span className="menu-item-with-shortcut">복사<span className="menu-item-shortcut">Ctrl+C</span></span>
      </Components.Generic.Menu.Item>
      <Components.Generic.Menu.Item className="bn-menu-item" icon={<MenuIcon d={MENU_ICONS.copy} />} onClick={duplicate}>
        복제
      </Components.Generic.Menu.Item>
      <Components.Generic.Menu.Item className="bn-menu-item" icon={<MenuIcon d={MENU_ICONS.trash} />} onClick={remove}>
        <span className="menu-item-with-shortcut">삭제<span className="menu-item-shortcut">Del</span></span>
      </Components.Generic.Menu.Item>
    </DragHandleMenu>
  );
}
