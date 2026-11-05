import { withSyncedDocument } from "../collabSession";
import type { ExportBlock } from "./blockModel";

export type ExportFormat = "pdf" | "html" | "markdown";

export const EXPORT_FORMATS: { value: ExportFormat; label: string; extension: string }[] = [
  { value: "pdf", label: "PDF", extension: "pdf" },
  { value: "html", label: "HTML", extension: "html" },
  { value: "markdown", label: "Markdown", extension: "md" },
];

// 파일 이름에 쓸 수 없는 글자를 바꾸고 비어 있으면 기본 이름
export function exportFileName(title: string, format: ExportFormat): string {
  const base = title.replace(/[\\/:*?"<>|]/g, "_").trim() || "제목 없음";
  const extension = EXPORT_FORMATS.find((f) => f.value === format)?.extension ?? format;
  return `${base}.${extension}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 협업 서버에서 본문을 받아 블록으로 변환 (편집기를 열지 않은 사이드바에서도 동작)
async function loadDocument(documentId: number) {
  const { yXmlFragmentToBlocks } = await import("@blocknote/core/yjs");
  return withSyncedDocument(documentId, ({ editor, fragment }) => ({
    editor,
    blocks: yXmlFragmentToBlocks(editor, fragment),
  }));
}

// 한글 글꼴(Pretendard)은 PDF를 만들 때 한 번만 등록
let fontsReady: Promise<void> | null = null;

function registerFonts(): Promise<void> {
  fontsReady ??= Promise.all([
    import("@react-pdf/renderer"),
    import("./PdfDocument"),
    import("pretendard/dist/web/static/woff/Pretendard-Regular.woff?url"),
    import("pretendard/dist/web/static/woff/Pretendard-Bold.woff?url"),
  ]).then(([{ Font }, { PDF_FONT }, regular, bold]) => {
    Font.register({
      family: PDF_FONT,
      fonts: [{ src: regular.default, fontWeight: 400 }, { src: bold.default, fontWeight: 700 }],
    });
    // 띄어쓰기 없이 긴 글자(주소 등)만 아무 곳에서나 줄을 바꾸고, 그 외에는 단어 단위로 줄바꿈
    Font.registerHyphenationCallback((word) => (word.length > 15 ? Array.from(word) : [word]));
  });
  return fontsReady;
}

async function toPdf(title: string, blocks: ExportBlock[]): Promise<Blob> {
  await registerFonts();
  const [{ pdf }, { PdfDocument }] = await Promise.all([import("@react-pdf/renderer"), import("./PdfDocument")]);
  return pdf(<PdfDocument title={title} blocks={blocks} />).toBlob();
}

// HTML은 다른 프로그램에서도 읽기 쉬운 단순한 구조로 (제목과 기본 표 테두리 포함)
function toHtml(title: string, body: string): Blob {
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
body { max-width: 760px; margin: 40px auto; padding: 0 16px; font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; line-height: 1.6; color: #37352f; }
table { border-collapse: collapse; } th, td { border: 1px solid #e9e9e7; padding: 4px 8px; } th { background: #f7f6f3; }
img { max-width: 100%; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${body}
</body>
</html>
`;
  return new Blob([html], { type: "text/html;charset=utf-8" });
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

// 페이지 본문을 고른 형식의 파일로 만들어 바로 내려받기
export async function exportDocument(params: { documentId: number; title: string; format: ExportFormat; userId: number }) {
  const { documentId, title, format } = params;
  const { editor, blocks } = await loadDocument(documentId);
  let blob: Blob;
  if (format === "pdf") {
    blob = await toPdf(title, blocks as unknown as ExportBlock[]);
  } else if (format === "html") {
    blob = toHtml(title, await editor.blocksToHTMLLossy(blocks));
  } else {
    const markdown = await editor.blocksToMarkdownLossy(blocks);
    blob = new Blob([`# ${title}\n\n${markdown}`], { type: "text/markdown;charset=utf-8" });
  }
  download(blob, exportFileName(title, format));
}
