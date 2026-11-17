import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { codeText, createCodeToolbar, createMermaidViewSwitch, filterLanguages, normalizeLanguage } from "./codeBlock";
import { editorSchema } from "./schema";
import type { CodeToolbarEditor } from "./codeBlock";

// jsdom은 SVG 크기를 잴 수 없어 실제 mermaid 대신 받은 코드를 그대로 담는 가짜 그림을 돌려줌
const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(async () => ({ diagramType: "sequence" })),
  render: vi.fn(async (_id: string, text: string) => ({ svg: `<svg><text>${text}</text></svg>` })),
}));
vi.mock("mermaid", () => ({ default: mermaidMock }));

const languages = {
  json: { name: "JSON" },
  javascript: { name: "JavaScript", aliases: ["js"] },
  python: { name: "Python", aliases: ["py"] },
};

function toolbarEditor(editable = true) {
  return {
    isEditable: editable,
    updateBlock: vi.fn((_id: string, _update: { props: { language?: string; mermaidView?: string } }) => undefined),
    getBlock: vi.fn((_id: string) => ({ content: [{ type: "text", text: "a = 1" }] })),
  } satisfies CodeToolbarEditor;
}

function mount(editable = true) {
  const editor = toolbarEditor(editable);
  const toolbar = createCodeToolbar({ id: "b1", props: { language: "json" } }, editor, languages);
  document.body.appendChild(toolbar.dom);
  return { editor, toolbar, button: toolbar.dom.querySelector<HTMLButtonElement>('[aria-label="코드 언어 선택"]')! };
}

// jsdom에는 화면 스크롤이 없어 목록 위치 맞춤만 무시
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  document.body.innerHTML = "";
  document.head.querySelectorAll("style").forEach((el) => el.remove());
});

describe("filterLanguages", () => {
  it("이름·키·별칭으로 언어를 찾는다", () => {
    expect(filterLanguages(languages, "py")).toEqual(["python"]);
    expect(filterLanguages(languages, "JS")).toEqual(["json", "javascript"]);
    expect(filterLanguages(languages, " ")).toEqual(["json", "javascript", "python"]);
  });
});

describe("codeText", () => {
  it("글자 조각을 이어 붙인다", () => {
    expect(codeText([{ type: "text", text: "a\n" }, { type: "text", text: "b" }])).toBe("a\nb");
    expect(codeText(undefined)).toBe("");
  });
});

describe("createCodeToolbar", () => {
  it("현재 언어 이름을 버튼에 보여준다", () => {
    expect(mount().button.textContent).toBe("JSON");
  });

  it("목록에서 검색 후 엔터로 언어를 바꾸고 목록을 닫는다", () => {
    const { editor, button } = mount();
    button.click();
    const input = document.querySelector<HTMLInputElement>(".code-lang-search")!;
    expect(document.activeElement).toBe(input);
    expect(document.querySelector('[aria-selected="true"]')?.textContent).toContain("JSON");

    input.value = "py";
    input.dispatchEvent(new Event("input"));
    expect([...document.querySelectorAll(".code-lang-option")].map((el) => el.textContent)).toEqual(["Python"]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(editor.updateBlock).toHaveBeenCalledWith("b1", { props: { language: "python" } });
    expect(document.querySelector(".code-lang-panel")).toBeNull();
  });

  it("Esc나 바깥을 누르면 언어를 바꾸지 않고 닫는다", () => {
    const { editor, button } = mount();
    button.click();
    document.querySelector(".code-lang-search")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(".code-lang-panel")).toBeNull();

    button.click();
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(document.querySelector(".code-lang-panel")).toBeNull();
    expect(editor.updateBlock).not.toHaveBeenCalled();
  });

  it("읽기 전용이면 언어 목록을 열지 않는다", () => {
    const { button } = mount(false);
    expect(button.disabled).toBe(true);
    button.click();
    expect(document.querySelector(".code-lang-panel")).toBeNull();
  });
});

describe("코드 블록 언어 맞춤", () => {
  it("별칭·이름·대소문자를 지원 목록 키로 바꾸고 모르는 언어는 일반 텍스트로 둔다", () => {
    const list = { text: { name: "Plain Text", aliases: ["txt"] }, shellscript: { name: "Shell", aliases: ["bash", "sh"] } };
    expect(normalizeLanguage(list, "bash")).toBe("shellscript");
    expect(normalizeLanguage(list, " Bash ")).toBe("shellscript");
    expect(normalizeLanguage(list, "Shell")).toBe("shellscript");
    expect(normalizeLanguage(list, "Plain Text")).toBe("text");
    expect(normalizeLanguage(list, "cobol")).toBe("text");
    expect(normalizeLanguage(list, undefined)).toBe("text");
  });

  // 노션에서 bash 코드 블록을 붙여넣으면 "Language bash is not supported." 오류로 붙여넣기가 실패하던 문제 재발 방지
  it("노션에서 붙여넣은 bash 코드 블록을 셸 언어로 받아 그린다", () => {
    const editor = BlockNoteEditor.create({ schema: editorSchema });
    const blocks = editor.tryParseHTMLToBlocks('<pre><code class="language-bash">echo hi\nls -al</code></pre>');
    expect(blocks[0]).toMatchObject({ type: "codeBlock", props: { language: "shellscript" } });

    editor.replaceBlocks(editor.document, blocks);
    const host = document.createElement("div");
    document.body.appendChild(host);
    expect(() => editor.mount(host)).not.toThrow();
    expect(host.querySelector('[aria-label="코드 언어 선택"]')?.textContent).toBe("Shell");
    editor.unmount();
  });

  it("이미 bash로 저장된 코드 블록도 오류 없이 그린다", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "codeBlock", props: { language: "bash" }, content: "echo hi" }],
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    expect(() => editor.mount(host)).not.toThrow();
    expect(host.querySelector('[aria-label="코드 언어 선택"]')?.textContent).toBe("Shell");
    editor.unmount();
  });
});

describe("Mermaid 코드 블록", () => {
  function mountBlock(language: string, content: string) {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "codeBlock", props: { language }, content }],
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    editor.mount(host);
    return { editor, host };
  }

  it("코드 아래에 그림을 그리고, 코드를 고치면 같은 영역에 다시 그린다", async () => {
    const { editor, host } = mountBlock("mermaid", "sequenceDiagram\n  A->>B: 요청");
    const preview = host.querySelector<HTMLDivElement>(".mermaid-preview")!;
    expect(preview.previousElementSibling?.tagName).toBe("PRE");
    await vi.waitFor(() => expect(preview.querySelector("svg")?.textContent).toContain("A->>B: 요청"));

    editor.updateBlock(editor.document[0], { content: "sequenceDiagram\n  A->>B: 응답" });
    await vi.waitFor(() => expect(preview.querySelector("svg")?.textContent).toContain("A->>B: 응답"));
    // 그림이 바뀌어도 블록을 다시 만들거나 문서 내용을 건드리지 않음
    expect(host.querySelector(".mermaid-preview")).toBe(preview);
    expect(editor.document[0].content).toEqual([{ type: "text", text: "sequenceDiagram\n  A->>B: 응답", styles: {} }]);
    editor.unmount();
  });

  it("다른 언어 코드 블록에는 그림 영역을 붙이지 않는다", () => {
    const { editor, host } = mountBlock("javascript", "const a = 1;");
    expect(host.querySelector(".mermaid-preview")).toBeNull();
    editor.unmount();
  });
});

describe("Mermaid 보기 전환", () => {
  function mountView(mermaidView?: "code" | "preview" | "split") {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "codeBlock", props: { language: "mermaid", ...(mermaidView && { mermaidView }) }, content: "graph TD\nA-->B" }],
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    editor.mount(host);
    const pressed = () => host.querySelector('.mermaid-view-switch [aria-pressed="true"]')?.textContent;
    const button = (label: string) => Array.from(host.querySelectorAll<HTMLButtonElement>(".mermaid-view-switch button"))
      .find((b) => b.textContent === label)!;
    return { editor, host, pressed, button };
  }

  it("기존 블록은 분할로 보이고 코드·미리보기·분할 버튼을 둔다", () => {
    const { editor, host, pressed } = mountView();
    expect(pressed()).toBe("분할");
    expect(Array.from(host.querySelectorAll(".mermaid-view-switch button"), (b) => b.textContent)).toEqual(["코드", "미리보기", "분할"]);
    expect(host.querySelector(".mermaid-preview")).not.toBeNull();
    expect(host.querySelector("pre.mermaid-code-hidden")).toBeNull();
    editor.unmount();
  });

  it("코드 보기는 그림 영역 없이 코드만 보인다", () => {
    const { editor, host, pressed } = mountView("code");
    expect(pressed()).toBe("코드");
    expect(host.querySelector(".mermaid-preview")).toBeNull();
    editor.unmount();
  });

  it("미리보기를 누르면 블록 속성에 저장하고 코드를 숨길 표시를 단다", () => {
    const { editor, host, pressed, button } = mountView();
    button("미리보기").click();
    expect(editor.document[0].props).toMatchObject({ mermaidView: "preview" });
    expect(pressed()).toBe("미리보기");
    expect(host.querySelector("pre.mermaid-code-hidden")).not.toBeNull();
    editor.unmount();
  });

  it("읽기 전용이면 보기 버튼을 눌러도 바꾸지 않는다", () => {
    const editor = toolbarEditor(false);
    const dom = createMermaidViewSwitch({ id: "b1", props: { mermaidView: "split" } }, editor);
    const buttons = Array.from(dom.querySelectorAll("button"));
    expect(buttons.every((b) => b.disabled)).toBe(true);
    buttons[0].click();
    expect(editor.updateBlock).not.toHaveBeenCalled();
  });
});
