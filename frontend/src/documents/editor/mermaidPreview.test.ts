import { afterEach, describe, expect, it, vi } from "vitest";
import { createMermaidPreview } from "./mermaidPreview";
import type { MermaidLike } from "./mermaidPreview";

function fakeMermaid(overrides: Pick<Partial<MermaidLike>, "parse"> = {}) {
  return {
    initialize: vi.fn(),
    parse: overrides.parse ?? vi.fn(async (_text: string) => ({ diagramType: "sequence" })),
    render: vi.fn(async (_id: string, text: string) => ({ svg: `<svg data-text="${text.length}"></svg>` })),
  };
}

// 대기 중인 타이머와 비동기 그리기를 모두 끝냄
async function settle() {
  await vi.runAllTimersAsync();
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("createMermaidPreview", () => {
  it("코드를 strict 보안 모드로 그려 SVG를 넣는다", async () => {
    vi.useFakeTimers();
    const mermaid = fakeMermaid();
    const preview = createMermaidPreview({ load: async () => mermaid });
    preview.update("sequenceDiagram\n  A->>B: 요청");
    await settle();

    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: "strict", startOnLoad: false }));
    expect(preview.dom.querySelector("svg")).not.toBeNull();
    expect(preview.dom.dataset.state).toBe("ready");
  });

  it("문법 오류면 그림 대신 오류 문구를 보여 준다", async () => {
    vi.useFakeTimers();
    const mermaid = fakeMermaid({ parse: vi.fn(async () => { throw new Error("Parse error on line 2"); }) });
    const preview = createMermaidPreview({ load: async () => mermaid });
    preview.update("sequenceDiagram\n  A->>");
    await settle();

    expect(mermaid.render).not.toHaveBeenCalled();
    expect(preview.dom.dataset.state).toBe("error");
    expect(preview.dom.textContent).toContain("Parse error on line 2");
  });

  it("빈 코드는 아무것도 그리지 않는다", async () => {
    vi.useFakeTimers();
    const mermaid = fakeMermaid();
    const preview = createMermaidPreview({ load: async () => mermaid });
    preview.update("   ");
    await settle();

    expect(mermaid.render).not.toHaveBeenCalled();
    expect(preview.dom.dataset.state).toBe("empty");
  });

  it("입력이 이어지면 멈춘 뒤 마지막 코드로 한 번만 다시 그린다", async () => {
    vi.useFakeTimers();
    const mermaid = fakeMermaid();
    const preview = createMermaidPreview({ load: async () => mermaid, delay: 300 });
    preview.update("graph TD");
    await settle();
    mermaid.render.mockClear();

    preview.update("graph TD\nA");
    await vi.advanceTimersByTimeAsync(100);
    preview.update("graph TD\nA-->B");
    await settle();

    expect(mermaid.render).toHaveBeenCalledTimes(1);
    expect(mermaid.render.mock.calls[0][1]).toBe("graph TD\nA-->B");
  });

  it("편집기가 다크 모드면 dark 테마로 그린다", async () => {
    vi.useFakeTimers();
    const mermaid = fakeMermaid();
    const root = document.createElement("div");
    root.className = "bn-root";
    root.setAttribute("data-color-scheme", "dark");
    document.body.appendChild(root);
    const preview = createMermaidPreview({ load: async () => mermaid });
    root.appendChild(preview.dom);
    preview.update("graph TD\nA-->B");
    await settle();

    expect(mermaid.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "dark" }));
  });

  it("제거된 뒤 끝난 그리기는 화면에 넣지 않는다", async () => {
    vi.useFakeTimers();
    const mermaid = fakeMermaid();
    const preview = createMermaidPreview({ load: async () => mermaid });
    preview.update("graph TD\nA-->B");
    preview.destroy();
    await settle();

    expect(preview.dom.querySelector("svg")).toBeNull();
  });
});
