import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { codeText, createCodeToolbar, filterLanguages } from "./codeBlock";
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
