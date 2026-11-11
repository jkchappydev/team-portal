import { createCodeBlockSpec } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import { showToast } from "../../toast/toastStore";
import { copyText } from "../clipboard";

export type CodeLanguages = Record<string, { name: string; aliases?: string[] }>;

// 코드 블록 도구 막대가 쓰는 편집기 기능만 추린 형태
export interface CodeToolbarEditor {
  isEditable: boolean;
  updateBlock(id: string, update: { props: { language: string } }): unknown;
  getBlock(id: string): { content?: unknown } | undefined;
}

interface CodeBlockLike {
  id: string;
  props: { language: string };
}

const PANEL_WIDTH = 240;
const PANEL_MAX_HEIGHT = 340;

// 검색어가 언어 이름·키·별칭 중 하나에 들어 있는 언어만 (빈 검색어면 전체)
export function filterLanguages(languages: CodeLanguages, query: string): string[] {
  const q = query.trim().toLowerCase();
  return Object.entries(languages)
    .filter(([key, { name, aliases }]) => !q || [key, name, ...(aliases ?? [])].some((v) => v.toLowerCase().includes(q)))
    .map(([key]) => key);
}

// 코드 블록 내용(글자 조각 목록)을 하나의 문자열로
export function codeText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content.map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : "")).join("");
}

function svgIcon(d: string, size = 14): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  return svg;
}

const CHEVRON = "M4 6l4 4 4-4";
const COPY = "M5.5 5.5V3.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M3.5 5.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z";

// 노션처럼 코드 블록 오른쪽 위에 언어 버튼과 복사 버튼을 두고, 언어 버튼은 검색되는 목록을 띄움
// 목록은 편집기 밖(body)에 띄워 검색 입력의 키 입력을 편집기가 가로채지 않게 함
export function createCodeToolbar(block: CodeBlockLike, editor: CodeToolbarEditor, languages: CodeLanguages) {
  const current = block.props.language;
  const dom = document.createElement("div");
  dom.className = "code-toolbar";
  dom.contentEditable = "false";

  const langButton = document.createElement("button");
  langButton.type = "button";
  langButton.className = "code-toolbar-button";
  langButton.setAttribute("aria-label", "코드 언어 선택");
  langButton.append(languages[current]?.name ?? current);
  if (editor.isEditable) langButton.appendChild(svgIcon(CHEVRON, 12));
  else langButton.disabled = true;

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "code-toolbar-button";
  copyButton.setAttribute("aria-label", "코드 복사");
  copyButton.title = "복사";
  copyButton.appendChild(svgIcon(COPY));

  dom.append(langButton, copyButton);

  // 버튼을 눌러도 편집기 선택·커서가 바뀌지 않게 함
  const keepSelection = (e: MouseEvent) => e.preventDefault();
  dom.addEventListener("mousedown", keepSelection);

  const copy = () => {
    copyText(codeText(editor.getBlock(block.id)?.content))
      .then(() => showToast("코드를 복사했습니다"))
      .catch(() => showToast("코드를 복사하지 못했습니다"));
  };
  copyButton.addEventListener("click", copy);

  let panel: HTMLDivElement | null = null;
  // 목록이 열린 동안 이 블록의 막대를 계속 보이게 하는 스타일 (막대 DOM을 바꾸면 편집기가 블록을 다시 그려 목록이 닫힘)
  let keepVisible: HTMLStyleElement | null = null;
  let cleanupPanel: (() => void) | null = null;

  const close = () => {
    cleanupPanel?.();
    cleanupPanel = null;
    panel?.remove();
    panel = null;
    keepVisible?.remove();
    keepVisible = null;
  };

  const choose = (language: string) => {
    close();
    if (language !== current && editor.isEditable) editor.updateBlock(block.id, { props: { language } });
  };

  const open = () => {
    if (!editor.isEditable) return;
    keepVisible = document.createElement("style");
    keepVisible.textContent = `.bn-block[data-id="${CSS.escape(block.id)}"] > .bn-block-content > .code-toolbar { opacity: 1; }`;
    document.head.appendChild(keepVisible);
    panel = document.createElement("div");
    panel.className = "code-lang-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "코드 언어 선택");
    const input = document.createElement("input");
    input.className = "code-lang-search";
    input.placeholder = "언어를 검색하세요";
    input.setAttribute("aria-label", "언어 검색");
    const list = document.createElement("div");
    list.className = "code-lang-list";
    list.setAttribute("role", "listbox");
    panel.append(input, list);
    document.body.appendChild(panel);

    // 버튼 아래 오른쪽 끝에 맞추고, 아래 공간이 모자라면 위로
    const rect = langButton.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8));
    panel.style.left = `${left}px`;
    if (window.innerHeight - rect.bottom < PANEL_MAX_HEIGHT && rect.top > window.innerHeight - rect.bottom) {
      panel.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    } else {
      panel.style.top = `${rect.bottom + 4}px`;
    }

    let keys: string[] = [];
    let active = 0;
    const render = () => {
      keys = filterLanguages(languages, input.value);
      active = Math.min(active, Math.max(keys.length - 1, 0));
      list.replaceChildren(...keys.map((key, index) => {
        const option = document.createElement("div");
        option.className = "code-lang-option";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(key === current));
        if (index === active) option.dataset.active = "";
        const name = document.createElement("span");
        name.textContent = languages[key].name;
        option.appendChild(name);
        if (key === current) {
          const check = document.createElement("span");
          check.className = "code-lang-check";
          check.textContent = "✓";
          option.appendChild(check);
        }
        option.addEventListener("mousedown", (e) => e.preventDefault());
        option.addEventListener("mouseenter", () => {
          active = index;
          list.querySelectorAll("[data-active]").forEach((el) => el.removeAttribute("data-active"));
          option.dataset.active = "";
        });
        option.addEventListener("click", () => choose(key));
        return option;
      }));
      if (keys.length === 0) {
        const empty = document.createElement("div");
        empty.className = "code-lang-empty";
        empty.textContent = "검색 결과가 없습니다";
        list.appendChild(empty);
      }
    };
    const scrollToActive = () => list.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" });

    active = Math.max(filterLanguages(languages, "").indexOf(current), 0);
    render();
    list.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "center" });

    input.addEventListener("input", () => {
      active = 0;
      render();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (keys.length === 0) return;
        active = (active + (e.key === "ArrowDown" ? 1 : keys.length - 1)) % keys.length;
        render();
        scrollToActive();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (keys[active]) choose(keys[active]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });

    // 바깥을 누르거나 화면이 움직이면 닫음
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panel?.contains(target) && !langButton.contains(target)) close();
    };
    const onScroll = (e: Event) => {
      if (!panel?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onOutside, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    cleanupPanel = () => {
      document.removeEventListener("mousedown", onOutside, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
    input.focus();
  };

  langButton.addEventListener("click", () => (panel ? close() : open()));

  return {
    dom,
    destroy: () => {
      close();
      dom.removeEventListener("mousedown", keepSelection);
      copyButton.removeEventListener("click", copy);
    },
  };
}

// BlockNote 코드 블록을 그대로 쓰되 기본 언어 선택 상자(브라우저 기본 목록)만 노션식 도구 막대로 교체
const baseCodeBlock = createCodeBlockSpec(codeBlockOptions);
// 기본 코드 블록은 항상 render를 가짐
const baseRender = baseCodeBlock.implementation.render!;

export const codeBlockSpec: typeof baseCodeBlock = {
  ...baseCodeBlock,
  implementation: {
    ...baseCodeBlock.implementation,
    render(block, editor) {
      const rendered = baseRender.apply(this as ThisParameterType<typeof baseRender>, [block, editor]);
      const toolbar = createCodeToolbar(block, editor as unknown as CodeToolbarEditor, codeBlockOptions.supportedLanguages);
      const select = rendered.dom.firstChild;
      if (select instanceof HTMLDivElement && select.querySelector("select")) select.replaceWith(toolbar.dom);
      else rendered.dom.insertBefore(toolbar.dom, rendered.dom.firstChild);
      return {
        ...rendered,
        destroy: () => {
          rendered.destroy?.();
          toolbar.destroy();
        },
      };
    },
  },
};
