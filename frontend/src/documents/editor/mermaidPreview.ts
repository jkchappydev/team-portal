import type { MermaidConfig } from "mermaid";

// Mermaid 코드 블록 보기 방식 (노션과 같은 코드·미리보기·분할)
export type MermaidView = "code" | "preview" | "split";
export const MERMAID_VIEWS: { value: MermaidView; label: string }[] = [
  { value: "code", label: "코드" },
  { value: "preview", label: "미리보기" },
  { value: "split", label: "분할" },
];

export function normalizeMermaidView(value: unknown): MermaidView {
  return MERMAID_VIEWS.some((view) => view.value === value) ? (value as MermaidView) : "split";
}

// 미리보기가 쓰는 mermaid 기능만 추린 형태 (테스트에서 가짜로 바꿔 끼움)
export interface MermaidLike {
  initialize(config: MermaidConfig): void;
  parse(text: string): Promise<unknown>;
  render(id: string, text: string): Promise<{ svg: string; bindFunctions?: (element: Element) => void }>;
}

export interface MermaidPreviewOptions {
  load?: () => Promise<MermaidLike>;
  // 입력이 멈춘 뒤 다시 그리기까지 기다리는 시간(ms)
  delay?: number;
}

export interface MermaidPreview {
  dom: HTMLDivElement;
  update(text: string): void;
  destroy(): void;
}

// mermaid는 크기가 커서 Mermaid 코드 블록이 처음 보일 때만 불러옴
let mermaidLoader: Promise<MermaidLike> | null = null;
function loadMermaid(): Promise<MermaidLike> {
  mermaidLoader ??= import("mermaid").then((module) => module.default as unknown as MermaidLike);
  return mermaidLoader;
}

// initialize(테마)와 render가 블록끼리 섞이지 않게 한 번에 하나씩 처리
let renderQueue: Promise<unknown> = Promise.resolve();
let renderSeq = 0;

type DrawResult = { svg: string; bindFunctions?: (element: Element) => void } | { error: string };

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const firstLines = message.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3).join("\n");
  return firstLines || "알 수 없는 오류";
}

function drawDiagram(mermaid: MermaidLike, text: string, dark: boolean, extra: MermaidConfig = {}): Promise<DrawResult> {
  const task = renderQueue.then(async (): Promise<DrawResult> => {
    const id = `mermaid-preview-${++renderSeq}`;
    // 사용자 입력이 그대로 그림이 되므로 스크립트·링크 클릭을 막는 strict 보안 모드로 그림
    // initialize 설정은 다음 호출까지 남으므로 htmlLabels 같은 값은 매번 명시
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "neutral", htmlLabels: true, ...extra });
    try {
      await mermaid.parse(text);
      return await mermaid.render(id, text);
    } catch (error) {
      return { error: errorMessage(error) };
    } finally {
      // 실패하면 mermaid가 body에 임시 요소를 남기는 경우가 있어 정리
      document.getElementById(`d${id}`)?.remove();
      document.getElementById(id)?.remove();
    }
  });
  renderQueue = task.catch(() => undefined);
  return task;
}

// 내보내기용 그림: HTML 글상자(foreignObject) 없이 순수 SVG로 그려 PNG로 바꾸거나 파일에 넣을 수 있게 함
export async function renderMermaidForExport(text: string, load: () => Promise<MermaidLike> = loadMermaid): Promise<string | null> {
  if (!text.trim()) return null;
  try {
    const result = await drawDiagram(await load(), text, false, { htmlLabels: false });
    return "error" in result ? null : result.svg;
  } catch {
    return null;
  }
}

function isDarkScheme(el: Element): boolean {
  return el.closest(".bn-root")?.getAttribute("data-color-scheme") === "dark";
}

// Mermaid 코드 블록 아래에 붙는 그림 영역, 코드가 바뀌면 잠시 뒤 다시 그림
export function createMermaidPreview(options: MermaidPreviewOptions = {}): MermaidPreview {
  const load = options.load ?? loadMermaid;
  const delay = options.delay ?? 300;
  const dom = document.createElement("div");
  dom.className = "mermaid-preview";
  dom.contentEditable = "false";
  dom.dataset.state = "empty";

  let text = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let version = 0;
  let destroyed = false;
  let themeObserver: MutationObserver | null = null;

  // 라이트·다크 전환 시 그림 색도 바꾸도록 편집기 색 모드를 지켜봄
  const watchTheme = () => {
    if (themeObserver) return;
    const root = dom.closest(".bn-root");
    if (!root) return;
    themeObserver = new MutationObserver(() => draw());
    themeObserver.observe(root, { attributes: true, attributeFilter: ["data-color-scheme"] });
  };

  const draw = async () => {
    const current = ++version;
    const source = text;
    if (!source.trim()) {
      dom.replaceChildren();
      dom.dataset.state = "empty";
      return;
    }
    let result: DrawResult;
    try {
      const mermaid = await load();
      if (destroyed || current !== version) return;
      result = await drawDiagram(mermaid, source, isDarkScheme(dom));
    } catch (error) {
      result = { error: errorMessage(error) };
    }
    if (destroyed || current !== version) return;
    watchTheme();
    if ("error" in result) {
      const message = document.createElement("div");
      message.className = "mermaid-preview-error";
      message.textContent = `다이어그램을 그릴 수 없습니다\n${result.error}`;
      dom.replaceChildren(message);
      dom.dataset.state = "error";
      return;
    }
    // strict 모드의 mermaid가 DOMPurify로 정리한 SVG
    dom.innerHTML = result.svg;
    result.bindFunctions?.(dom);
    dom.dataset.state = "ready";
  };

  return {
    dom,
    update(next) {
      if (destroyed || next === text) return;
      const first = text === "" && version === 0;
      text = next;
      clearTimeout(timer);
      // 처음 그릴 때는 기다리지 않고, 입력 중에는 멈출 때까지 기다림
      timer = setTimeout(() => void draw(), first ? 0 : delay);
    },
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      themeObserver?.disconnect();
    },
  };
}
