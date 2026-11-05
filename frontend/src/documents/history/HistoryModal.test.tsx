import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getHistoryVersion, listHistory } from "../../api/history";
import { HistoryModal } from "./HistoryModal";
import { base64ToBytes, bytesToBase64, restoreVersion } from "./versionContent";

vi.mock("../../api/history", () => ({
  listHistory: vi.fn(),
  getHistoryVersion: vi.fn(),
}));
vi.mock("./versionContent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./versionContent")>()),
  versionToBlocks: vi.fn(() => Promise.resolve([])),
  restoreVersion: vi.fn(() => Promise.resolve()),
}));
vi.mock("./VersionPreview", () => ({ default: () => <div>본문 미리보기</div> }));
vi.mock("../../user/currentUser", () => ({
  useCurrentUser: () => ({ user: { id: 3, name: "홍길동", active: true }, select: vi.fn(), clear: vi.fn() }),
}));

const entries = [
  { id: 6, createdAt: "2026-11-05T02:20:00Z", createdByName: "홍길동", reason: "BEFORE_RESTORE" as const },
  { id: 5, createdAt: "2026-11-05T01:00:00Z", createdByName: null, reason: "AUTO" as const },
];

describe("HistoryModal", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  beforeEach(() => {
    vi.mocked(listHistory).mockResolvedValue(entries);
    vi.mocked(getHistoryVersion).mockImplementation((_, id) =>
      Promise.resolve({ ...entries.find((e) => e.id === id)!, contentState: "AQID" }));
    vi.mocked(restoreVersion).mockClear();
  });

  afterEach(cleanup);

  function renderModal() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <HistoryModal opened documentId={7} title="배포 절차" onClose={vi.fn()} />
        </QueryClientProvider>
      </MantineProvider>,
    );
  }

  it("시점 목록을 최근순으로 보여주고, 수정자 기록이 없거나 되돌리기 전 사본이면 표시한다", async () => {
    renderModal();
    expect(await screen.findByText("수정자 기록 없음")).toBeTruthy();
    expect(screen.getByText("되돌리기 전")).toBeTruthy();
    // 처음에는 가장 최근 시점 본문을 보여줌
    expect(await screen.findByText("본문 미리보기")).toBeTruthy();
    expect(getHistoryVersion).toHaveBeenCalledWith(7, 6);
  });

  it("다른 시점을 고르고 확인하면 그 버전으로 되돌린다", async () => {
    renderModal();
    fireEvent.click(await screen.findByText("수정자 기록 없음"));
    await waitFor(() => expect(getHistoryVersion).toHaveBeenCalledWith(7, 5));
    await screen.findByText("본문 미리보기");
    fireEvent.click(screen.getByRole("button", { name: "이 버전으로 되돌리기" }));
    expect(screen.getByText("지금 본문을 이 버전으로 바꿀까요?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    await waitFor(() => expect(restoreVersion).toHaveBeenCalledWith(7, 3, "AQID"));
  });

  it("이력이 없으면 자동 저장 안내를 보여준다", async () => {
    vi.mocked(listHistory).mockResolvedValue([]);
    renderModal();
    expect(await screen.findByText(/아직 저장된 이력이 없습니다/)).toBeTruthy();
  });
});

describe("versionContent", () => {
  it("Base64와 바이트 배열을 서로 변환한다", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual([0, 1, 2, 250, 255]);
    expect(bytesToBase64(new Uint8Array([1, 2, 3]))).toBe("AQID");
  });
});
