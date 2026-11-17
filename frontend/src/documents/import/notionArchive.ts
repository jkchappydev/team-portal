import { unzipSync } from "fflate";

// 노션 내보내기 파일들 (ZIP 안 경로 → 내용)
export type ArchiveFiles = Map<string, Uint8Array>;

// 노션 페이지 HTML 하나와 그 하위 페이지
export interface NotionPageNode {
  // ZIP 안 경로 (예: "개인 페이지/인생서가 500f….html")
  path: string;
  // 파일 이름에서 ID를 뺀 제목 (HTML 안 제목이 우선)
  fileTitle: string;
  // 하위 페이지·이미지·첨부 파일이 들어 있는 짝 폴더 경로 (끝에 "/")
  folder: string;
  children: NotionPageNode[];
}

// 노션 파일 이름 끝의 32자리 페이지 ID ("제목 0123…abcd.html")
const PAGE_FILE = /^(.*?)\s+([0-9a-f]{32})\.html$/i;

function isIgnored(path: string): boolean {
  return path.startsWith("__MACOSX/") || path.endsWith("/") || /(^|\/)\.[^/]+$/.test(path);
}

// ZIP(또는 HTML 하나)을 경로별 내용으로 풀어 둠, ZIP 안에 ZIP만 있으면(큰 내보내기) 안쪽도 풂
export async function readNotionFiles(file: File): Promise<ArchiveFiles> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!/\.zip$/i.test(file.name)) return new Map([[file.name, bytes]]);
  return unzipAll(bytes);
}

export function unzipAll(bytes: Uint8Array): ArchiveFiles {
  const files: ArchiveFiles = new Map();
  for (const [path, data] of Object.entries(unzipSync(bytes))) {
    if (isIgnored(path)) continue;
    if (/\.zip$/i.test(path)) {
      for (const [inner, innerData] of unzipAll(data)) files.set(inner, innerData);
    } else {
      files.set(path, data);
    }
  }
  return files;
}

function dirOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index + 1);
}

// 페이지 HTML로 트리를 만듦: "제목 ID.html"의 하위 페이지는 같은 위치의 "제목/" 폴더 바로 안의 HTML
// 짝 폴더가 다른 페이지 폴더가 아닌 HTML은 최상위 페이지 (노션이 최상위에 두는 "개인 페이지 & 공유된 페이지/" 같은 폴더 포함)
export function buildPageTree(files: ArchiveFiles): NotionPageNode[] {
  const nodes = [...files.keys()].filter((path) => /\.html$/i.test(path)).sort().map((path): NotionPageNode => {
    const name = path.slice(dirOf(path).length);
    const match = PAGE_FILE.exec(name);
    const fileTitle = (match ? match[1] : name.replace(/\.html$/i, "")).trim();
    return { path, fileTitle, folder: `${dirOf(path)}${fileTitle}/`, children: [] };
  });
  const byFolder = new Map(nodes.map((node) => [node.folder, node]));
  const roots: NotionPageNode[] = [];
  for (const node of nodes) {
    const parent = byFolder.get(dirOf(node.path));
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

// 페이지 HTML 안 상대 주소를 ZIP 안 경로로 (주소의 %인코딩은 한 번만 풂: 파일 이름 자체에 %가 있을 수 있음)
export function resolveArchivePath(pagePath: string, href: string): string | null {
  if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#") || href.startsWith("/")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(href.split("#")[0].split("?")[0]);
  } catch {
    return null;
  }
  const parts = (dirOf(pagePath) + decoded).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== "." && part !== "") resolved.push(part);
  }
  return resolved.join("/");
}

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  pdf: "application/pdf", txt: "text/plain", csv: "text/csv", json: "application/json", zip: "application/zip",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4", mp3: "audio/mpeg",
};

// ZIP 안 파일을 올릴 수 있는 File로 (종류는 확장자로)
export function archiveFile(path: string, data: Uint8Array): File {
  const name = path.slice(dirOf(path).length);
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";
  return new File([data as BlobPart], name, { type: MIME[extension] ?? "application/octet-stream" });
}

export function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
}
