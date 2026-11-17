import { normalizeMermaidView, renderMermaidForExport } from "../editor/mermaidPreview";
import type { MermaidView } from "../editor/mermaidPreview";
import type { ExportBlock } from "./blockModel";

export interface MermaidImage {
  src: string;
  width: number;
  height: number;
}

// 내보내기에서 쓰는 Mermaid 그리기·PNG 변환 (테스트에서 가짜로 바꿔 끼움)
export interface MermaidExportRenderer {
  toSvg(text: string): Promise<string | null>;
  toPng(svg: string): Promise<MermaidImage | null>;
}

const MERMAID_LANGUAGES = ["mermaid", "mmd"];

function plainText(content: ExportBlock["content"]): string {
  if (!Array.isArray(content)) return "";
  return content.map((part) => ("text" in part ? String(part.text) : "")).join("");
}

export function isMermaidBlock(block: ExportBlock): boolean {
  return block.type === "codeBlock" && MERMAID_LANGUAGES.includes(String(block.props?.language ?? "").toLowerCase());
}

export function mermaidViewOf(block: ExportBlock): MermaidView {
  return normalizeMermaidView(block.props?.mermaidView);
}

// 문서 순서(하위 블록 포함)대로 모든 코드 블록을 나열
export function flattenCodeBlocks(blocks: ExportBlock[]): ExportBlock[] {
  return blocks.flatMap((block) => [
    ...(block.type === "codeBlock" ? [block] : []),
    ...flattenCodeBlocks(block.children ?? []),
  ]);
}

// SVG의 viewBox로 실제 크기를 정해 2배 해상도 PNG로 바꿈 (PDF 라이브러리는 SVG 문자열을 그대로 넣지 못함)
export async function svgToPng(svg: string): Promise<MermaidImage | null> {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  const viewBox = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const width = viewBox[2] || Number.parseFloat(root.getAttribute("width") ?? "") || 0;
  const height = viewBox[3] || Number.parseFloat(root.getAttribute("height") ?? "") || 0;
  if (!width || !height) return null;
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  root.removeAttribute("style");
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(root))}`;
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("SVG를 이미지로 읽지 못했습니다"));
    image.src = url;
  });
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { src: canvas.toDataURL("image/png"), width, height };
}

const defaultRenderer: MermaidExportRenderer = {
  toSvg: (text) => renderMermaidForExport(text),
  toPng: (svg) => svgToPng(svg).catch(() => null),
};

// 코드 보기가 아닌 Mermaid 블록마다 SVG를 그려 둠 (실패한 블록은 코드로만 내보냄)
async function renderAll(blocks: ExportBlock[], renderer: MermaidExportRenderer): Promise<Map<ExportBlock, string>> {
  const svgs = new Map<ExportBlock, string>();
  for (const block of flattenCodeBlocks(blocks)) {
    if (!isMermaidBlock(block) || mermaidViewOf(block) === "code") continue;
    const svg = await renderer.toSvg(plainText(block.content)).catch(() => null);
    if (svg) svgs.set(block, svg);
  }
  return svgs;
}

// PDF용: Mermaid 블록에 PNG 그림(props.mermaidImage)을 붙인 복사본을 만듦
export async function attachMermaidImages(blocks: ExportBlock[], renderer: MermaidExportRenderer = defaultRenderer): Promise<ExportBlock[]> {
  const svgs = await renderAll(blocks, renderer);
  if (svgs.size === 0) return blocks;
  const images = new Map<ExportBlock, MermaidImage>();
  for (const [block, svg] of svgs) {
    const image = await renderer.toPng(svg);
    if (image) images.set(block, image);
  }
  const attach = (list: ExportBlock[]): ExportBlock[] => list.map((block) => {
    const image = images.get(block);
    const children = block.children ? attach(block.children) : block.children;
    return image ? { ...block, props: { ...block.props, mermaidImage: image }, children } : { ...block, children };
  });
  return attach(blocks);
}

// HTML용: 내보낸 HTML의 코드 블록을 문서 순서대로 맞춰 Mermaid 그림(SVG)을 넣고, 미리보기 보기면 코드를 뺌
export async function addMermaidToHtml(html: string, blocks: ExportBlock[], renderer: MermaidExportRenderer = defaultRenderer): Promise<string> {
  const svgs = await renderAll(blocks, renderer);
  if (svgs.size === 0) return html;
  const container = document.createElement("div");
  container.innerHTML = html;
  const codeBlocks = flattenCodeBlocks(blocks);
  const pres = Array.from(container.querySelectorAll("pre")).filter((pre) => pre.querySelector(":scope > code"));
  // 블록 수와 HTML 코드 블록 수가 다르면 잘못 짝지을 수 있어 그림을 넣지 않음
  if (pres.length !== codeBlocks.length) return html;
  codeBlocks.forEach((block, index) => {
    const svg = svgs.get(block);
    if (!svg) return;
    const pre = pres[index];
    const figure = document.createElement("div");
    figure.className = "mermaid-diagram";
    figure.innerHTML = svg;
    pre.after(figure);
    if (mermaidViewOf(block) === "preview") pre.remove();
  });
  return container.innerHTML;
}
