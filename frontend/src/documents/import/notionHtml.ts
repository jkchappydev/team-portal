import { COLOR_NAMES } from "../editor/colorStyles";
import { resolveArchivePath } from "./notionArchive";

// 변환 결과 블록 (BlockNote PartialBlock 형태)
export interface ImportBlock {
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: ImportBlock[];
}

export interface NotionPageInfo {
  title: string;
  icon: string | null;
  // 본문의 하위 페이지 링크(figure.link-to-page) 순서대로 ZIP 안 경로
  childLinks: string[];
  // 본문이 쓰는 이미지·첨부 파일의 ZIP 안 경로
  assets: string[];
}

export interface ConvertContext {
  pagePath: string;
  // 가져오며 만든 페이지 문서 id (ZIP 안 HTML 경로 기준)
  pageIdFor: (path: string) => number | undefined;
  // 올린 이미지·첨부 파일 주소 (ZIP 안 경로 기준)
  assetUrl: (path: string) => string | undefined;
  // 일반 HTML 조각을 편집기 블록으로 (편집기의 tryParseHTMLToBlocks)
  parseHtml: (html: string) => ImportBlock[];
  // 가져오지 못한 항목 이름 모음
  skipped: string[];
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function bodyOf(doc: Document): Element {
  return doc.querySelector(".page-body") ?? doc.body;
}

// 페이지 제목·아이콘, 하위 페이지 링크 순서, 쓰는 파일 목록
export function readPageInfo(html: string, pagePath: string): NotionPageInfo {
  const doc = parse(html);
  const header = doc.querySelector("header");
  const title = header?.querySelector(".page-title")?.textContent?.trim() || doc.title.trim();
  const iconEl = header?.querySelector(".page-header-icon .icon");
  // 이모지 아이콘만 옮김 (이미지 아이콘은 옮길 수 없음)
  const icon = iconEl && iconEl.tagName !== "IMG" ? iconEl.textContent?.trim() || null : null;
  const body = bodyOf(doc);
  const childLinks = [...body.querySelectorAll("figure.link-to-page a[href]")]
    .map((a) => resolveArchivePath(pagePath, a.getAttribute("href") ?? ""))
    .filter((path): path is string => !!path && /\.html$/i.test(path));
  const assets = new Set<string>();
  for (const el of body.querySelectorAll("img[src], a[href]")) {
    if (el.matches("img.icon")) continue;
    const path = resolveArchivePath(pagePath, el.getAttribute(el.tagName === "IMG" ? "src" : "href") ?? "");
    if (path && !/\.html$/i.test(path)) assets.add(path);
  }
  return { title, icon, childLinks: [...new Set(childLinks)], assets: [...assets] };
}

// block-color-red / block-color-red_background → 블록 글자색·배경색
function colorProps(el: Element): Record<string, string> {
  const cls = [...el.classList].find((c) => c.startsWith("block-color-"));
  const match = cls && /^block-color-([a-z]+?)(_background)?$/.exec(cls);
  if (!match || !(COLOR_NAMES as readonly string[]).includes(match[1])) return {};
  return match[2] ? { backgroundColor: match[1] } : { textColor: match[1] };
}

function noticeColor(value: string | null): { backgroundColor: string; textColor: string } {
  const match = /^([a-z]+?)(_background)?$/.exec(value ?? "");
  if (!match || !(COLOR_NAMES as readonly string[]).includes(match[1])) return { backgroundColor: "gray", textColor: "default" };
  return match[2] ? { backgroundColor: match[1], textColor: "default" } : { backgroundColor: "default", textColor: match[1] };
}

const BLOCK_TAGS = new Set(["UL", "OL", "DIV", "FIGURE", "DETAILS", "PRE", "TABLE", "BLOCKQUOTE", "ASIDE", "P", "H1", "H2", "H3", "HR"]);

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function convertNotionBody(html: string, ctx: ConvertContext): ImportBlock[] {
  const doc = parse(html);
  const body = bodyOf(doc);

  // 글 안 링크: 가져온 페이지면 이 앱 주소로, 올린 파일이면 그 주소로, 없는 페이지 링크는 글자만 남김
  for (const a of body.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const path = resolveArchivePath(ctx.pagePath, a.getAttribute("href") ?? "");
    if (!path) continue;
    if (/\.html$/i.test(path)) {
      const id = ctx.pageIdFor(path);
      if (id !== undefined) a.setAttribute("href", `/documents/${id}`);
      else a.removeAttribute("href");
    } else {
      const url = ctx.assetUrl(path);
      if (url) a.setAttribute("href", url);
    }
  }
  // 데이터베이스 관계 속성 아이콘 같은 글 안 작은 이미지는 뺌
  body.querySelectorAll("img.icon").forEach((img) => img.remove());

  // 글줄 하나의 인라인 내용
  const inline = (el: Element): unknown => {
    const blocks = ctx.parseHtml(`<p>${el.innerHTML}</p>`);
    return blocks[0]?.content ?? [];
  };

  const generic = (el: Element): ImportBlock[] => {
    const blocks = ctx.parseHtml(el.outerHTML);
    const colors = colorProps(el);
    if (blocks[0] && Object.keys(colors).length > 0) blocks[0] = { ...blocks[0], props: { ...blocks[0].props, ...colors } };
    return blocks;
  };

  const imageBlock = (img: HTMLImageElement, caption: string): ImportBlock | null => {
    const src = img.getAttribute("src") ?? "";
    const path = resolveArchivePath(ctx.pagePath, src);
    const url = path ? ctx.assetUrl(path) : /^https?:\/\//i.test(src) ? src : undefined;
    if (!url) {
      ctx.skipped.push(path ? fileName(path) : src);
      return null;
    }
    const width = Number.parseFloat(img.style.width);
    return {
      type: "image",
      props: { url, caption, ...(Number.isFinite(width) && width > 0 ? { previewWidth: Math.round(width) } : {}) },
    };
  };

  const listItems = (list: Element): ImportBlock[] => {
    const type = list.tagName === "OL" ? "numberedListItem" : list.classList.contains("to-do-list") ? "checkListItem" : "bulletListItem";
    return [...list.children].filter((li) => li.tagName === "LI").map((li) => {
      const text = li.cloneNode(true) as Element;
      // 하위 블록(목록·들여쓴 블록 등)은 하위로, 나머지 글자는 이 줄 내용으로
      const nested = [...li.children].filter((child) => BLOCK_TAGS.has(child.tagName) && !child.matches(".checkbox"));
      [...text.children].forEach((child) => {
        if ((BLOCK_TAGS.has(child.tagName) && !child.matches(".checkbox")) || child.matches(".checkbox")) child.remove();
      });
      const props: Record<string, unknown> = { ...colorProps(li) };
      if (type === "checkListItem") props.checked = !!li.querySelector(":scope > .checkbox-on");
      const children = convertNodes(nested.flatMap((child) => (child.matches("div.indented") ? [...child.children] : [child])));
      return { type, props, content: inline(text), children };
    });
  };

  const convertElement = (el: Element): ImportBlock[] => {
    if (el.matches("aside")) {
      const icon = el.getAttribute("data-notion-callout-icon") || el.querySelector(".icon")?.textContent?.trim() || "💡";
      const colors = noticeColor(el.getAttribute("data-notion-callout-background"));
      const inner = [...el.children].find((child) => child.matches("div[style*='width']")) ?? el.lastElementChild ?? el;
      const children = convertNodes([...inner.children]);
      return [{ type: "callout", props: { icon, ...colors }, children: children.length > 0 ? children : [{ type: "paragraph" }] }];
    }
    if (el.matches("details")) {
      const summary = el.querySelector(":scope > summary");
      const heading = summary?.querySelector(":scope > h1, :scope > h2, :scope > h3");
      const rest = [...el.children].filter((child) => child !== summary)
        .flatMap((child) => (child.matches("div.indented") ? [...child.children] : [child]));
      const children = convertNodes(rest);
      if (heading) {
        return [{ type: "heading", props: { level: Number(heading.tagName[1]), isToggleable: true, ...colorProps(heading) }, content: inline(heading), children }];
      }
      return [{ type: "toggleListItem", props: colorProps(el), content: summary ? inline(summary) : [], children }];
    }
    if (el.matches("div.column-list")) {
      const columns = [...el.children].filter((child) => child.matches("div.column"));
      if (columns.length < 2) return columns.flatMap((column) => convertNodes([...column.children]));
      return [{
        type: "columnList",
        children: columns.map((column) => {
          const width = Number.parseFloat((column as HTMLElement).style.width);
          const children = convertNodes([...column.children]);
          return { type: "column", props: { width: Number.isFinite(width) && width > 0 ? width : 1 }, children: children.length > 0 ? children : [{ type: "paragraph" }] };
        }),
      }];
    }
    if (el.matches("figure.link-to-page")) {
      const a = el.querySelector("a");
      const path = resolveArchivePath(ctx.pagePath, a?.getAttribute("href") ?? "");
      const id = path ? ctx.pageIdFor(path) : undefined;
      // 위에서 이 앱 주소로 바꾼 링크
      const appId = /^\/documents\/(\d+)$/.exec(a?.getAttribute("href") ?? "")?.[1];
      const documentId = id ?? (appId ? Number(appId) : undefined);
      if (documentId !== undefined) return [{ type: "page", props: { documentId } }];
      return a ? [{ type: "paragraph", content: inline(a) }] : [];
    }
    if (el.matches("figure") && el.querySelector("img")) {
      const block = imageBlock(el.querySelector("img")!, el.querySelector("figcaption")?.textContent?.trim() ?? "");
      return block ? [block] : [];
    }
    if (el.matches("div.source") || (el.matches("figure") && el.querySelector(":scope > div.source"))) {
      const a = el.querySelector("a[href]");
      const href = a?.getAttribute("href") ?? "";
      if (!a) return [];
      // 위에서 올린 파일 주소로 바뀐 링크는 첨부 파일 블록, 바깥 주소는 링크 줄
      if (/^https?:\/\//i.test(href) && !href.includes("/api/")) return [{ type: "paragraph", content: inline(a) }];
      const path = resolveArchivePath(ctx.pagePath, href);
      if (path) {
        ctx.skipped.push(fileName(path));
        return [];
      }
      return [{ type: "file", props: { url: href, name: a.textContent?.trim() || "파일" } }];
    }
    if (el.matches("figure")) {
      // 북마크·임베드·수식 등: 링크나 글자로만 남김
      const a = el.querySelector("a[href]");
      return [{ type: "paragraph", content: inline(a ?? el) }];
    }
    if (el.matches("ul, ol")) return listItems(el);
    if (el.matches("hr")) return [{ type: "divider" }];
    if (el.matches("table.properties, header, style, script")) return [];
    if (el.matches("div") && !el.matches("div.indented")) return convertNodes([...el.children]);
    return generic(el);
  };

  // 형제 블록들을 차례로 변환하고, 바로 뒤 div.indented는 앞 블록의 하위 블록으로 붙임
  function convertNodes(nodes: Element[]): ImportBlock[] {
    const blocks: ImportBlock[] = [];
    for (const el of nodes) {
      if (el.matches("div.indented")) {
        const children = convertNodes([...el.children]);
        const last = blocks[blocks.length - 1];
        if (last && !["columnList", "page", "image", "file", "divider", "table"].includes(last.type)) {
          last.children = [...(last.children ?? []), ...children];
        } else {
          blocks.push(...children);
        }
        continue;
      }
      blocks.push(...convertElement(el));
    }
    return blocks;
  }

  return convertNodes([...body.children]);
}
