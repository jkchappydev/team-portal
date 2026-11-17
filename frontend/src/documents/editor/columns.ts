import { createBlockSpec } from "@blocknote/core";
import { createColumnResizeHandle } from "./ColumnResizeHandle";

// 노션처럼 블록을 가로로 나란히 놓는 열 묶음: 열(column)만 담고, 열이 하나만 남으면 풀려서 안의 블록만 남음
export const createColumnListBlock = createBlockSpec(
  {
    type: "columnList",
    propSchema: {},
    content: "none",
    layoutOnly: true,
    children: { allow: ["column"], min: 2 },
  },
  {
    renderFrame: () => {
      const dom = document.createElement("div");
      dom.className = "bn-column-list";
      return { dom, slot: dom };
    },
    // 내보내기(HTML)에서는 열을 가로로 나란히 둠
    toExternalHTML: () => {
      const dom = document.createElement("div");
      dom.className = "column-list";
      dom.style.display = "flex";
      dom.style.gap = "48px";
      return { dom, childrenDOM: dom };
    },
  },
);

function applyWidth(element: HTMLElement, width: unknown) {
  element.style.flexGrow = String(Number(width) || 1);
}

// 열 묶음 안의 열 한 칸: 일반 블록을 담고(열 묶음은 못 담음) 너비는 같은 묶음 안 다른 열과의 비율
export const createColumnBlock = createBlockSpec(
  {
    type: "column",
    propSchema: { width: { default: 1 } },
    content: "none",
    layoutOnly: true,
    children: { exclude: ["columnList"] },
    placeable: "namedOnly",
  },
  {
    renderFrame: (block, editor) => {
      const dom = document.createElement("div");
      dom.className = "bn-column";
      applyWidth(dom, block.props.width);
      const handle = createColumnResizeHandle(block.id, editor);
      const slot = document.createElement("div");
      slot.className = "bn-column-slot";
      dom.append(handle.dom, slot);
      return {
        dom,
        slot,
        update: (next) => {
          applyWidth(dom, next.props.width);
          return true;
        },
        destroy: handle.destroy,
      };
    },
    toExternalHTML: (block) => {
      const dom = document.createElement("div");
      dom.className = "column";
      dom.style.flex = `${Number(block.props.width) || 1} 1 0`;
      dom.style.minWidth = "0";
      return { dom, childrenDOM: dom };
    },
  },
);
