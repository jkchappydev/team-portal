import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { importNotion } from "./importNotion";
import { ImportModal } from "./ImportModal";

vi.mock("./importNotion", () => ({
  importNotion: vi.fn(async (_file: File, _target: unknown, onProgress?: (p: unknown) => void) => {
    onProgress?.({ done: 1, total: 2, current: "회의" });
    return { pages: 2, files: 3, skipped: ["회의: big.png"] };
  }),
}));

const target = { spaceId: 1, documentId: 7, title: "제목 없음", icon: null, applyTitle: true };

function renderModal(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>
        <ImportModal opened target={target} onClose={onClose} />
      </MantineProvider>
    </QueryClientProvider>,
  );
  return onClose;
}

function chooseFile(name = "export.zip") {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File([new Uint8Array([1])], name)] } });
}

describe("ImportModal", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(cleanup);

  it("파일을 고르기 전에는 가져오기를 누를 수 없고, 가져오면 결과와 건너뛴 파일을 보여 준다", async () => {
    renderModal();
    const button = await screen.findByRole("button", { name: "가져오기" });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    chooseFile();
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));

    await waitFor(() => expect(importNotion).toHaveBeenCalledWith(expect.any(File), target, expect.any(Function)));
    expect(await screen.findByText("페이지 2개, 파일 3개를 가져왔습니다.")).toBeTruthy();
    expect(screen.getByText("회의: big.png")).toBeTruthy();
    expect(screen.getByRole("button", { name: "닫기" })).toBeTruthy();
  });

  it("실패하면 이유를 보여 준다", async () => {
    vi.mocked(importNotion).mockRejectedValueOnce(new Error("노션에서 HTML로 내보낸 파일(.zip 또는 .html)이 아닙니다."));
    renderModal();
    chooseFile("readme.zip");
    fireEvent.click(await screen.findByRole("button", { name: "가져오기" }));

    expect(await screen.findByText("노션에서 HTML로 내보낸 파일(.zip 또는 .html)이 아닙니다.")).toBeTruthy();
  });
});
