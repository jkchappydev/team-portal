import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FilePreview } from "./FilePreview";

// 워드 미리보기 라이브러리: 받은 내용이 워드 파일이 아니면 실패하도록 흉내
const renderAsync = vi.fn(async (buffer: ArrayBuffer) => {
  if (new TextDecoder().decode(buffer) !== "DOCX") throw new Error("워드 파일이 아님");
});
vi.mock("docx-preview", () => ({ renderAsync: (buffer: ArrayBuffer) => renderAsync(buffer) }));

const files: Record<string, string> = { "/files/memo.txt": "메모 내용", "/files/minutes.docx": "DOCX" };

describe("FilePreview", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  beforeEach(() => {
    renderAsync.mockClear();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(new TextEncoder().encode(files[url]))));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const view = (url: string, fileName: string) => <MantineProvider><FilePreview url={url} fileName={fileName} /></MantineProvider>;

  it("다른 파일로 옮겨 가도 이전 파일 내용으로 미리보기를 그리지 않는다", async () => {
    const { rerender } = render(view("/files/memo.txt", "memo.txt"));
    expect(await screen.findByText("메모 내용")).toBeTruthy();

    rerender(view("/files/minutes.docx", "minutes.docx"));

    await waitFor(() => expect(renderAsync).toHaveBeenCalled());
    expect(renderAsync.mock.calls.every(([buffer]) => new TextDecoder().decode(buffer) === "DOCX")).toBe(true);
    expect(screen.queryByText("워드 문서를 표시하지 못했습니다. 다운로드해서 열어 주세요.")).toBeNull();
  });
});
