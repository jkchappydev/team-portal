import { describe, expect, it, vi } from "vitest";
import type { ExportBlock } from "./blockModel";
import { addMermaidToHtml, attachMermaidImages, flattenCodeBlocks } from "./mermaidExport";
import type { MermaidExportRenderer } from "./mermaidExport";

function mermaidBlock(text: string, mermaidView?: string): ExportBlock {
  return { type: "codeBlock", props: { language: "mermaid", ...(mermaidView && { mermaidView }) }, content: [{ type: "text", text }] };
}

// 받은 코드를 담은 SVG와 고정 크기 PNG를 돌려주는 가짜 렌더러
function fakeRenderer(failText?: string) {
  return {
    toSvg: vi.fn(async (text: string) => (text === failText ? null : `<svg><text>${text}</text></svg>`)),
    toPng: vi.fn(async (svg: string) => ({ src: `png:${svg}`, width: 100, height: 50 })),
  } satisfies MermaidExportRenderer;
}

describe("flattenCodeBlocks", () => {
  it("하위 블록까지 문서 순서대로 코드 블록을 모은다", () => {
    const inner = mermaidBlock("graph TD");
    const blocks: ExportBlock[] = [
      { type: "codeBlock", props: { language: "javascript" }, content: [] },
      { type: "bulletListItem", content: [], children: [inner] },
    ];
    expect(flattenCodeBlocks(blocks)).toEqual([blocks[0], inner]);
  });
});

describe("attachMermaidImages", () => {
  it("코드 보기가 아닌 Mermaid 블록에만 그림을 붙이고 원본은 바꾸지 않는다", async () => {
    const renderer = fakeRenderer();
    const blocks: ExportBlock[] = [
      mermaidBlock("graph A"),
      mermaidBlock("graph B", "code"),
      { type: "toggleListItem", content: [], children: [mermaidBlock("graph C", "preview")] },
      { type: "codeBlock", props: { language: "javascript" }, content: [{ type: "text", text: "a" }] },
    ];
    const result = await attachMermaidImages(blocks, renderer);

    expect(result[0].props?.mermaidImage).toEqual({ src: "png:<svg><text>graph A</text></svg>", width: 100, height: 50 });
    expect(result[1].props?.mermaidImage).toBeUndefined();
    expect(result[2].children?.[0].props?.mermaidImage).toBeDefined();
    expect(result[3].props?.mermaidImage).toBeUndefined();
    expect(renderer.toSvg).toHaveBeenCalledTimes(2);
    expect(blocks[0].props?.mermaidImage).toBeUndefined();
  });

  it("그리지 못한 블록은 코드로만 남긴다", async () => {
    const result = await attachMermaidImages([mermaidBlock("broken")], fakeRenderer("broken"));
    expect(result[0].props?.mermaidImage).toBeUndefined();
  });
});

describe("addMermaidToHtml", () => {
  const html = '<pre><code class="language-javascript">a</code></pre><pre><code class="language-mermaid">graph A</code></pre>'
    + '<pre><code class="language-mermaid">graph B</code></pre>';
  const blocks: ExportBlock[] = [
    { type: "codeBlock", props: { language: "javascript" }, content: [{ type: "text", text: "a" }] },
    mermaidBlock("graph A"),
    mermaidBlock("graph B", "preview"),
  ];

  it("분할은 코드 뒤에 그림을 넣고, 미리보기는 코드를 빼고 그림만 남긴다", async () => {
    const container = document.createElement("div");
    container.innerHTML = await addMermaidToHtml(html, blocks, fakeRenderer());

    expect(container.querySelectorAll("pre")).toHaveLength(2);
    const figures = container.querySelectorAll(".mermaid-diagram");
    expect(Array.from(figures, (figure) => figure.textContent)).toEqual(["graph A", "graph B"]);
    expect(figures[0].previousElementSibling?.textContent).toBe("graph A");
    expect(figures[1].previousElementSibling).toBe(figures[0]);
  });

  it("HTML 코드 블록 수가 문서와 다르면 그대로 둔다", async () => {
    expect(await addMermaidToHtml(html, blocks.slice(1), fakeRenderer())).toBe(html);
  });
});
