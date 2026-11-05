// @vitest-environment node
import { Font, pdf } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";
import type { ExportBlock } from "./blockModel";
import { PDF_FONT, PdfDocument } from "./PdfDocument";

// 실제 내보내기와 같은 한글 글꼴을 파일에서 등록
beforeAll(() => {
  // 테스트는 Node 환경에서 돌아 프로젝트 폴더 기준으로 글꼴 파일을 읽음
  const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd();
  const dir = `${cwd}/node_modules/pretendard/dist/web/static/woff`;
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: `${dir}/Pretendard-Regular.woff`, fontWeight: 400 },
      { src: `${dir}/Pretendard-Bold.woff`, fontWeight: 700 },
    ],
  });
});

// 제목·목록·체크리스트·인용·코드·구분선·색·링크·표(제목 행·칸 색)가 섞인 본문
const blocks: ExportBlock[] = [
  { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "품의 내용" }] },
  { type: "paragraph", props: { textColor: "red" }, content: [
    { type: "text", text: "굵은 글자", styles: { bold: true } },
    { type: "text", text: " 와 " },
    { type: "link", href: "https://example.com", content: [{ type: "text", text: "링크" }] },
  ] },
  { type: "bulletListItem", content: [{ type: "text", text: "항목" }], children: [
    { type: "numberedListItem", content: [{ type: "text", text: "하위 번호" }] },
  ] },
  { type: "checkListItem", props: { checked: true }, content: [{ type: "text", text: "완료한 일" }] },
  { type: "quote", content: [{ type: "text", text: "인용" }] },
  { type: "codeBlock", content: [{ type: "text", text: "const a = 1;" }] },
  { type: "divider" },
  { type: "table", content: {
    type: "tableContent",
    headerRows: 1,
    rows: [
      { cells: [{ type: "tableCell", props: { backgroundColor: "red" }, content: [{ type: "text", text: "항목" }] },
        [{ type: "text", text: "금액" }]] },
      { cells: [[{ type: "text", text: "서버" }], [{ type: "text", text: "1,200" }]] },
    ],
  } },
  { type: "file", props: { name: "회의록.docx" } },
];

describe("PdfDocument", () => {
  it("여러 블록이 섞인 본문으로 PDF 파일을 만든다", async () => {
    const blob = await pdf(<PdfDocument title="품의서" blocks={blocks} />).toBlob();
    const head = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5));

    expect(head).toBe("%PDF-");
    expect(blob.size).toBeGreaterThan(1000);
  }, 30000);
});
