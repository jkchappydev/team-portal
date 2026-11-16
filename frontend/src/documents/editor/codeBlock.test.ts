import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { codeText, createCodeToolbar, filterLanguages, normalizeLanguage } from "./codeBlock";
import { editorSchema } from "./schema";
import type { CodeToolbarEditor } from "./codeBlock";

const languages = {
  json: { name: "JSON" },
  javascript: { name: "JavaScript", aliases: ["js"] },
  python: { name: "Python", aliases: ["py"] },
};

function toolbarEditor(editable = true) {
  return {
    isEditable: editable,
    updateBlock: vi.fn((_id: string, _update: { props: { language: string } }) => undefined),
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
