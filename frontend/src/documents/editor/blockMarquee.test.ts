import { describe, expect, it, vi } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { anchorAt, copyBlocks, installBlockMarquee, marqueeKeyAction, marqueeRect, marqueeSelection, pickMarqueeBlocks, readMarqueeBlocks } from "./blockMarquee";
import { editorSchema } from "./schema";
import type { MarqueeBlock } from "./blockMarquee";

const rect = (top: number, bottom: number) => ({ left: 100, right: 600, top, bottom });
const block = (id: string, top: number, bottom: number, children: MarqueeBlock[] = []): MarqueeBlock => ({
  id, rect: rect(top, bottom), childrenTop: children.length > 0 ? children[0].rect.top : undefined, children,
});

// 0~30 a, 40~140 콜아웃{50~80 제목, 80~110 본문}, 150~180 b
const doc = [
  block("a", 0, 30),
  block("callout", 40, 140, [block("title", 50, 80), block("body", 80, 110)]),
  block("b", 150, 180),
];

describe("끌어서 여러 블록 고르기", () => {
  it("사각형에 걸린 바깥 블록을 고른다 (콜아웃은 통째로)", () => {
    expect(pickMarqueeBlocks(doc, { left: 50, right: 300, top: 10, bottom: 160 })).toEqual(["a", "callout", "b"]);
  });

  it("블록 글 영역에 닿지 않으면 고르지 않는다 (왼쪽 여백에서만 끈 경우)", () => {
    expect(pickMarqueeBlocks(doc, { left: 20, right: 90, top: 10, bottom: 160 })).toEqual([]);
  });

  it("콜아웃 안 줄 영역에서만 끌면 그 안의 줄을 고른다", () => {
    expect(pickMarqueeBlocks(doc, { left: 50, right: 300, top: 60, bottom: 100 })).toEqual(["title", "body"]);
  });

  it("콜아웃 위 끝을 넘어 끌면 콜아웃 통째로 고른다", () => {
    expect(pickMarqueeBlocks(doc, { left: 50, right: 300, top: 35, bottom: 100 })).toEqual(["callout"]);
  });
});

describe("끄는 도중 스크롤", () => {
  it("시작점을 본문 기준으로 기억해 본문이 위로 스크롤돼도 처음 누른 자리에서 사각형이 시작된다", () => {
    // 본문 위 끝이 화면 100px일 때 (20, 150)을 누름
    const anchor = anchorAt({ left: 0, top: 100 }, 20, 150);
    // 마우스는 그대로 (300, 400)인데 휠로 200px 내려 본문 위 끝이 화면 -100px이 됨
    expect(marqueeRect(anchor, { left: 0, top: -100 }, 300, 400)).toEqual({ left: 20, top: -50, right: 300, bottom: 400 });
  });

  it("위로 끌면 시작점이 아래쪽 끝이 된다", () => {
    const anchor = anchorAt({ left: 10, top: 0 }, 50, 500);
    expect(marqueeRect(anchor, { left: 10, top: 0 }, 30, 200)).toEqual({ left: 30, top: 200, right: 50, bottom: 500 });
  });
});

describe("고른 블록 복사", () => {
  // 고른 뒤 편집기 포커스를 빼 두므로 포커스를 먼저 돌려준 뒤 블록 범위를 선택하고 복사해야 클립보드에 들어감
  it("편집기 포커스를 돌려준 뒤 첫 블록 처음~마지막 블록 끝을 선택하고 복사한다", () => {
    const editor = BlockNoteEditor.create({
      initialContent: [{ type: "paragraph", content: "줄 1" }, { type: "paragraph", content: "줄 2" }, { type: "paragraph", content: "줄 3" }],
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    editor.mount(host);
    const view = editor.prosemirrorView!;
    const order: string[] = [];
    const focus = vi.spyOn(view, "focus").mockImplementation(() => { order.push("focus"); });
    const execCommand = vi.fn(() => {
      order.push("copy");
      const { from, to } = view.state.selection;
      order.push(view.state.doc.textBetween(from, to, "|"));
      return true;
    });
    document.execCommand = execCommand;
    const ids = editor.document.slice(0, 2).map((block) => block.id);

    copyBlocks(editor, ids);

    expect(focus).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(order).toEqual(["focus", "copy", "줄 1|줄 2"]);
    editor.unmount();
    host.remove();
  });
});

describe("고른 블록 단축키", () => {
  const key = (key: string, code: string, ctrlKey = false) => ({ key, code, ctrlKey, metaKey: false });

  // 한글 입력 상태에서는 Ctrl+C·X의 key가 자모나 "Process"로 오므로 자판 위치로도 판단
  it("한글 입력 상태의 Ctrl+C·X도 복사·잘라내기로 본다", () => {
    expect(marqueeKeyAction(key("ㅊ", "KeyC", true))).toBe("copy");
    expect(marqueeKeyAction(key("Process", "KeyC", true))).toBe("copy");
    expect(marqueeKeyAction(key("ㅌ", "KeyX", true))).toBe("cut");
    expect(marqueeKeyAction(key("Process", "KeyX", true))).toBe("cut");
  });

  it("영문 입력 상태와 Cmd 조합도 그대로 처리한다", () => {
    expect(marqueeKeyAction(key("c", "KeyC", true))).toBe("copy");
    expect(marqueeKeyAction(key("C", "KeyC", true))).toBe("copy");
    expect(marqueeKeyAction({ key: "x", code: "KeyX", ctrlKey: false, metaKey: true })).toBe("cut");
  });

  it("Ctrl 없이 누른 c는 아무것도 하지 않고 Delete·Backspace·Esc는 각각 처리한다", () => {
    expect(marqueeKeyAction(key("ㅊ", "KeyC"))).toBeNull();
    expect(marqueeKeyAction(key("c", "KeyC"))).toBeNull();
    expect(marqueeKeyAction(key("Delete", "Delete"))).toBe("delete");
    expect(marqueeKeyAction(key("Process", "Backspace"))).toBe("delete");
    expect(marqueeKeyAction(key("Escape", "Escape"))).toBe("escape");
  });
});

describe("고른 블록을 손잡이로 끌기", () => {
  // 블록 i는 화면 위 i*30 ~ i*30+30에 있다고 보고, 사각형으로 2~4번째 블록을 고른 상태를 만듦
  const setup = () => {
    const editor = BlockNoteEditor.create({
      initialContent: Array.from({ length: 6 }, (_, i) => ({ type: "paragraph" as const, content: `줄 ${i + 1}` })),
    });
    const area = document.createElement("main");
    const host = document.createElement("div");
    const sideMenu = document.createElement("div");
    sideMenu.className = "bn-side-menu";
    const handle = document.createElement("div");
    handle.setAttribute("draggable", "true");
    sideMenu.appendChild(handle);
    area.append(host, sideMenu);
    document.body.appendChild(area);
    editor.mount(host);
    const ids = editor.document.map((block) => block.id);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const index = ids.indexOf(this.getAttribute("data-id") ?? "");
      if (index < 0 || !this.classList.contains("bn-block")) return new DOMRect(0, 0, 700, 0);
      return new DOMRect(100, index * 30, 500, 30);
    });
    const controller = new AbortController();
    installBlockMarquee(editor, area, controller.signal);
    const mouse = (type: string, target: EventTarget, x: number, y: number) =>
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
    mouse("mousedown", area, 20, 35);
    mouse("mousemove", document, 400, 100);
    mouse("mouseup", document, 400, 100);
    const cleanup = () => {
      controller.abort();
      editor.unmount();
      area.remove();
      vi.restoreAllMocks();
    };
    return { editor, ids, area, handle, mouse, cleanup };
  };

  // 예전에는 손잡이를 누르는 순간 고른 블록이 풀려 손잡이 블록 하나만 옮겨졌음
  it("고른 블록이 있을 때 손잡이를 눌러도 선택이 남아 함께 끌 수 있다", () => {
    const { editor, ids, handle, mouse, cleanup } = setup();
    expect(marqueeSelection(editor)).toEqual(ids.slice(1, 4));

    mouse("mousedown", handle, 130, 45);
    expect(marqueeSelection(editor)).toEqual(ids.slice(1, 4));

    handle.dispatchEvent(new Event("dragend", { bubbles: true }));
    expect(marqueeSelection(editor)).toEqual([]);
    cleanup();
  });

  it("손잡이를 누르고 끌지 않고 떼면 선택을 푼다", () => {
    const { editor, handle, mouse, cleanup } = setup();
    mouse("mousedown", handle, 130, 45);
    mouse("mouseup", document, 130, 45);
    expect(marqueeSelection(editor)).toEqual([]);
    cleanup();
  });

  it("손잡이가 아닌 곳을 누르면 바로 선택을 푼다", () => {
    const { editor, area, mouse, cleanup } = setup();
    mouse("mousedown", area, 20, 300);
    expect(marqueeSelection(editor)).toEqual([]);
    cleanup();
  });
});

describe("토글·열 묶음이 섞인 문서의 블록 읽기", () => {
  it("토글·열 묶음과 그 뒤 블록도 모두 고를 수 있는 블록으로 읽는다", () => {
    const original = Element.prototype.getBoundingClientRect;
    // jsdom은 크기가 0이라 모든 요소를 높이 10으로 둠
    Element.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 10, left: 0, right: 100, width: 100, height: 10, x: 0, y: 0, toJSON: () => ({}) });
    try {
      const editor = BlockNoteEditor.create({ schema: editorSchema, initialContent: [
        { id: "p1", type: "paragraph", content: "가" },
        { id: "t1", type: "toggleListItem", content: "기존", children: [{ id: "tc", type: "paragraph", content: "안" }] },
        { id: "b1", type: "bulletListItem", content: "유저", children: [{ id: "b2", type: "bulletListItem", content: "Repo" }] },
        { id: "q1", type: "quote", content: "자주있는 CS" },
        { id: "cl", type: "columnList", children: [
          { id: "c1", type: "column", props: { width: 1 }, children: [{ id: "in1", type: "toggleListItem", content: "열 안 토글" }] },
        ] },
        { id: "p2", type: "paragraph", content: "나" },
      ] });
      const host = document.createElement("div");
      document.body.appendChild(host);
      editor.mount(host);
      const root = editor.prosemirrorView.dom;
      const blocks = readMarqueeBlocks(root);
      // 열 묶음(.bn-block-outer로 감싸지 않음)도 고를 수 있고, 그 안의 블록은 열 묶음의 하위로 읽음
      expect(blocks.map((b) => b.id)).toEqual(["p1", "t1", "b1", "q1", "cl", "p2"]);
      // BlockNote가 열 끝에 빈 줄을 하나 더 붙일 수 있어 첫 블록만 확인
      expect(blocks.find((b) => b.id === "cl")!.children[0].id).toBe("in1");
      // 토글 안 블록(.bn-toggle-frame 안)도 하위로 읽어 토글 안에서만 고를 수 있음
      expect(blocks.find((b) => b.id === "t1")!.children.map((b) => b.id)).toEqual(["tc"]);
      editor.unmount();
      host.remove();
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
  });
});
