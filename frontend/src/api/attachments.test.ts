import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadAttachment } from "./attachments";
import { setStoredUserId } from "../user/currentUser";

describe("uploadAttachment", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploadAttachment는 FormData에 file과 inline=true를 넣고 Content-Type을 지정하지 않는다", async () => {
    setStoredUserId(5);
    const dto = {
      id: 11,
      originalName: "사진.png",
      contentType: "image/png",
      size: 3,
      uploadedByName: "홍길동",
      createdAt: "2026-11-04T00:00:00Z",
      url: "/api/attachments/11/download",
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: dto, error: null })));
    const file = new File(["abc"], "사진.png", { type: "image/png" });

    const result = await uploadAttachment(42, file, true);

    expect(result).toEqual(dto);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/documents/42/attachments");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect((body.get("file") as File).name).toBe("사진.png");
    expect(body.get("inline")).toBe("true");
    const headers = new Headers(init.headers);
    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.get("X-User-Id")).toBe("5");
  });

  it("inline을 생략하면 inline=false로 보낸다", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: {}, error: null })));

    await uploadAttachment(1, new File(["x"], "a.txt"));

    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("inline")).toBe("false");
  });
});
