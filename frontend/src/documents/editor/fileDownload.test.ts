import { afterEach, describe, expect, it, vi } from "vitest";
import { attachmentDownloadUrl, downloadFile, downloadName } from "./fileDownload";

const origin = window.location.origin;

describe("attachmentDownloadUrl", () => {
  it("우리 서버 첨부 주소는 바로 저장 옵션을 붙인다", () => {
    expect(attachmentDownloadUrl("/api/attachments/3/download", origin)).toBe("/api/attachments/3/download?download=true");
    expect(attachmentDownloadUrl(`${origin}/api/attachments/4/download`, origin)).toBe("/api/attachments/4/download?download=true");
  });

  it("외부 주소나 첨부가 아닌 주소는 null", () => {
    expect(attachmentDownloadUrl("https://x.com/api/attachments/3/download", origin)).toBeNull();
    expect(attachmentDownloadUrl("/files/3", origin)).toBeNull();
  });
});

describe("downloadName", () => {
  it("블록 이름이 있으면 그 이름, 없으면 주소 마지막 부분", () => {
    expect(downloadName("https://x.com/a/photo.png", "회의 사진.png")).toBe("회의 사진.png");
    expect(downloadName("https://x.com/a/%EC%82%AC%EC%A7%84.png")).toBe("사진.png");
    expect(downloadName("https://x.com/")).toBe("download");
  });
});

describe("downloadFile", () => {
  afterEach(() => vi.restoreAllMocks());

  it("우리 첨부는 새 탭 없이 다운로드 링크를 누른다", async () => {
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    await downloadFile("/api/attachments/3/download");

    expect(clicked).toHaveLength(1);
    expect(clicked[0].getAttribute("href")).toBe("/api/attachments/3/download?download=true");
    expect(clicked[0].hasAttribute("download")).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it("외부 이미지를 받을 수 없으면 새 탭으로 연다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("CORS")));
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    await downloadFile("https://x.com/a.png");

    expect(open).toHaveBeenCalledWith("https://x.com/a.png", "_blank", "noopener");
    vi.unstubAllGlobals();
  });
});
