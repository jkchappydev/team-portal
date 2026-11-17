import { describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { strToU8, zipSync } from "fflate";
import { TABLE_OPTIONS } from "../collabSession";
import { editorSchema } from "../editor/schema";
import { buildPageTree, resolveArchivePath, unzipAll } from "./notionArchive";
import { convertNotionBody, readPageInfo } from "./notionHtml";
import type { ImportBlock } from "./notionHtml";

// 실제 노션 HTML 내보내기와 같은 구조 (내용은 가짜)
const page = (title: string, icon: string | null, body: string) => `<html><head><title>${title}</title></head><body><article class="page sans">
<header>${icon ? `<div class="page-header-icon undefined"><span class="icon">${icon}</span></div>` : ""}<h1 class="page-title">${title}</h1><p class="page-description"></p></header>
<div class="page-body">${body}</div></article></body></html>`;

const ROOT = "개인 페이지 & 공유된 페이지/시험 문서 0123456789abcdef0123456789abcdef.html";
const CHILD = "개인 페이지 & 공유된 페이지/시험 문서/하위 (01 20 버전) fedcba9876543210fedcba9876543210.html";
const GRANDCHILD = "개인 페이지 & 공유된 페이지/시험 문서/하위 (01 20 버전)/손자 11112222333344445555666677778888.html";

const rootBody = `
<p id="a" class="">첫 <strong>굵게</strong> <mark class="highlight-teal">청록</mark> 글</p>
<h2 id="b" class="block-color-yellow_background" data-notion-highlight="yellow_background">노란 제목</h2>
<aside class="block-color-gray_background callout" data-notion-callout="" data-notion-callout-icon="📌" data-notion-callout-background="blue_background" style="white-space:pre-wrap;display:flex"><div style="font-size:1.5em"><span class="icon">📌</span></div><div style="width:100%"><p class="">콜아웃 첫 줄</p><p class="">콜아웃 둘째 줄</p></div></aside>
<details open="" class="toggle"><summary>토글 제목</summary><div class="indented"><pre class="code code-wrap" data-notion-code-syntax="json"><code class="language-json">{"a": 1}</code></pre></div></details>
<div class="column-list" data-notion-column-list=""><div style="width:50%" class="column"><figure class="image" style="text-align:left"><a href="%EC%8B%9C%ED%97%98%20%EB%AC%B8%EC%84%9C/image.png"><img style="width:160.5px" src="%EC%8B%9C%ED%97%98%20%EB%AC%B8%EC%84%9C/image.png"/></a><figcaption>그림 설명</figcaption></figure></div><div style="width:50%" class="column"><p class="">오른쪽 글</p></div></div>
<table class="simple-table"><thead class="simple-table-header"><tr><th class="simple-table-header-color simple-table-header">항목</th><th class="simple-table-header-color simple-table-header">값</th></tr></thead><tbody><tr><td><code>a</code><br/><code>b</code></td><td>설명</td></tr></tbody></table>
<ul class="bulleted-list"><li style="list-style-type:disc">목록 하나<ul class="bulleted-list"><li style="list-style-type:circle">하위 목록</li></ul></li></ul>
<ol type="1" class="numbered-list" start="1"><li>번호 하나</li></ol>
<figure class="link-to-page"><a href="%EC%8B%9C%ED%97%98%20%EB%AC%B8%EC%84%9C/%ED%95%98%EC%9C%84%20(01%2020%20%EB%B2%84%EC%A0%84)%20fedcba9876543210fedcba9876543210.html">하위 (01 20 버전)</a></figure>
<div class="source"><a href="%EC%8B%9C%ED%97%98%20%EB%AC%B8%EC%84%9C/%25EC%259E%2590%25EB%25A3%258C.xlsx">%EC%9E%90%EB%A3%8C.xlsx</a></div>
<p class="">본문 안 <a href="%EC%8B%9C%ED%97%98%20%EB%AC%B8%EC%84%9C/%ED%95%98%EC%9C%84%20(01%2020%20%EB%B2%84%EC%A0%84)%20fedcba9876543210fedcba9876543210.html">하위 링크</a>와 <a href="https://example.com">바깥 링크</a></p>
<hr/>`;

function sampleZip(): Uint8Array {
  return zipSync({
    [ROOT]: strToU8(page("시험 문서", "🧪", rootBody)),
    "개인 페이지 & 공유된 페이지/시험 문서/image.png": new Uint8Array([137, 80, 78, 71]),
    "개인 페이지 & 공유된 페이지/시험 문서/%EC%9E%90%EB%A3%8C.xlsx": new Uint8Array([1, 2, 3]),
    [CHILD]: strToU8(page("하위 (01 20 버전)", null, `<p class="">하위 본문</p>`)),
    [GRANDCHILD]: strToU8(page("손자", "📄", `<p class="">손자 본문</p>`)),
  });
}

const parser = BlockNoteEditor.create({ schema: editorSchema, tables: TABLE_OPTIONS });
const parseHtml = (html: string) => parser.tryParseHTMLToBlocks(html) as unknown as ImportBlock[];
const text = (block: ImportBlock) => (Array.isArray(block.content) ? block.content.map((c: { text?: string; content?: { text: string }[] }) => c.text ?? c.content?.map((x) => x.text).join("") ?? "").join("") : "");

describe("노션 내보내기 ZIP", () => {
  it("ZIP 안 ZIP도 풀고, 페이지 짝 폴더로 하위 페이지 트리를 만든다", () => {
    const outer = zipSync({ "Export-part1.zip": sampleZip() });
    const files = unzipAll(outer);
    const roots = buildPageTree(files);

    expect(roots.map((r) => r.fileTitle)).toEqual(["시험 문서"]);
    expect(roots[0].children.map((c) => c.fileTitle)).toEqual(["하위 (01 20 버전)"]);
    expect(roots[0].children[0].children.map((c) => c.fileTitle)).toEqual(["손자"]);
  });

  it("상대 주소를 ZIP 안 경로로 바꾸고, 파일 이름의 %는 한 번만 푼다", () => {
    expect(resolveArchivePath(ROOT, "%EC%8B%9C%ED%97%98%20%EB%AC%B8%EC%84%9C/%25EC%259E%2590%25EB%25A3%258C.xlsx"))
      .toBe("개인 페이지 & 공유된 페이지/시험 문서/%EC%9E%90%EB%A3%8C.xlsx");
    expect(resolveArchivePath(ROOT, "https://example.com")).toBeNull();
  });
});

describe("노션 페이지 HTML 변환", () => {
  it("제목·아이콘·하위 페이지 링크·파일 목록을 읽는다", () => {
    const info = readPageInfo(page("시험 문서", "🧪", rootBody), ROOT);
    expect(info.title).toBe("시험 문서");
    expect(info.icon).toBe("🧪");
    expect(info.childLinks).toEqual([CHILD]);
    expect(info.assets.sort()).toEqual([
      "개인 페이지 & 공유된 페이지/시험 문서/%EC%9E%90%EB%A3%8C.xlsx",
      "개인 페이지 & 공유된 페이지/시험 문서/image.png",
    ]);
  });

  it("콜아웃·토글·다단·이미지·표·목록·페이지 링크·첨부 파일을 앱 블록으로 바꾼다", () => {
    const skipped: string[] = [];
    const blocks = convertNotionBody(page("시험 문서", "🧪", rootBody), {
      pagePath: ROOT,
      pageIdFor: (path) => (path === CHILD ? 42 : undefined),
      assetUrl: (path) => (path.endsWith("image.png") ? "/api/attachments/1/download" : path.endsWith(".xlsx") ? "/api/attachments/2/download" : undefined),
      parseHtml,
      skipped,
    });
    const types = blocks.map((b) => b.type);
    expect(types).toEqual(["paragraph", "heading", "callout", "toggleListItem", "columnList", "table", "bulletListItem",
      "numberedListItem", "page", "file", "paragraph", "divider"]);

    expect(blocks[1].props).toMatchObject({ level: 2, backgroundColor: "yellow" });
    expect(blocks[2].props).toMatchObject({ icon: "📌", backgroundColor: "blue" });
    expect(blocks[2].children!.map(text)).toEqual(["콜아웃 첫 줄", "콜아웃 둘째 줄"]);
    expect(text(blocks[3])).toBe("토글 제목");
    expect(blocks[3].children![0]).toMatchObject({ type: "codeBlock", props: { language: "json" } });
    const columns = blocks[4].children!;
    expect(columns.map((c) => [c.type, c.props?.width])).toEqual([["column", 50], ["column", 50]]);
    expect(columns[0].children![0]).toMatchObject({ type: "image", props: { url: "/api/attachments/1/download", caption: "그림 설명", previewWidth: 161 } });
    expect(blocks[6].children!.map(text)).toEqual(["하위 목록"]);
    expect(blocks[8]).toEqual({ type: "page", props: { documentId: 42 } });
    expect(blocks[9]).toMatchObject({ type: "file", props: { url: "/api/attachments/2/download" } });
    const linkHrefs = (blocks[10].content as { type: string; href?: string }[]).filter((c) => c.type === "link").map((c) => c.href);
    expect(linkHrefs).toEqual(["/documents/42", "https://example.com"]);
    expect(skipped).toEqual([]);
  });

  it("올리지 못한 이미지는 건너뛴 목록에 남긴다", () => {
    const skipped: string[] = [];
    const blocks = convertNotionBody(page("시험", null, `<figure class="image"><img src="%EC%8B%9C%ED%97%98/big.png"/></figure>`), {
      pagePath: "시험 0123456789abcdef0123456789abcdef.html",
      pageIdFor: () => undefined,
      assetUrl: () => undefined,
      parseHtml,
      skipped,
    });
    expect(blocks).toEqual([]);
    expect(skipped).toEqual(["big.png"]);
  });
});
