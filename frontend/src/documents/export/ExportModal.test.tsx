import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { exportDocument, exportFileName } from "./exportDocument";
import { ExportModal } from "./ExportModal";

vi.mock("./exportDocument", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./exportDocument")>()),
  exportDocument: vi.fn(() => Promise.resolve()),
}));
vi.mock("../../user/currentUser", () => ({
  useCurrentUser: () => ({ user: { id: 3, name: "홍길동", active: true }, select: vi.fn(), clear: vi.fn() }),
}));

describe("exportFileName", () => {
  it("파일 이름에 쓸 수 없는 글자를 바꾸고 형식별 확장자를 붙인다", () => {
    expect(exportFileName("품의서/2026: 최종", "pdf")).toBe("품의서_2026_ 최종.pdf");
    expect(exportFileName("회의록", "markdown")).toBe("회의록.md");
    expect(exportFileName("  ", "html")).toBe("제목 없음.html");
  });
});

describe("ExportModal", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(cleanup);

  it("기본 형식 PDF로 내보내고 끝나면 창을 닫는다", async () => {
    const onClose = vi.fn();
    render(
      <MantineProvider>
        <ExportModal opened documentId={7} title="배포 절차" onClose={onClose} />
      </MantineProvider>,
    );

    expect(await screen.findByText("내보내기 형식")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));

    await waitFor(() => expect(exportDocument).toHaveBeenCalledWith({ documentId: 7, title: "배포 절차", format: "pdf", userId: 3 }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("실패하면 창을 닫지 않고 이유를 보여준다", async () => {
    vi.mocked(exportDocument).mockRejectedValueOnce(new Error("본문에 접속하지 못했습니다."));
    const onClose = vi.fn();
    render(
      <MantineProvider>
        <ExportModal opened documentId={7} title="배포 절차" onClose={onClose} />
      </MantineProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "내보내기" }));

    expect(await screen.findByText("본문에 접속하지 못했습니다.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
