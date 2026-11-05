import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentUpdatesBell } from "./DocumentUpdatesBell";
import { listDocumentUpdates, markAllDocumentUpdatesRead } from "../api/notifications";
import { formatRelative, updatePath } from "./updateFormat";
import { useCurrentUser } from "../user/currentUser";
import { countPendingSignups } from "../api/admin";

const update = (id: number, title: string, kind: "PAGE" | "FILE" = "PAGE") => ({
  id, spaceId: 1, spaceName: "스쿨북스", title, icon: null, updatedByName: "김동료",
  updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(), parentId: null, kind, fileUrl: null,
});

vi.mock("../api/notifications", () => ({
  listDocumentUpdates: vi.fn(),
  markAllDocumentUpdatesRead: vi.fn(() => Promise.resolve()),
}));
vi.mock("../api/spaces", () => ({
  listSpaces: () => Promise.resolve([{ id: 1, name: "스쿨북스", description: null, documentCount: 1, homeDocumentId: 10, icon: null }]),
}));
vi.mock("../user/currentUser", () => ({ useCurrentUser: vi.fn() }));
vi.mock("../api/admin", () => ({ countPendingSignups: vi.fn() }));

describe("DocumentUpdatesBell", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    // jsdom에 없는 크기 감시 기능 (목록 스크롤 영역이 사용)
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCurrentUser).mockReturnValue({ user: { id: 1, name: "팀원", active: true, admin: false }, me: null });
  });

  function renderBell() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<DocumentUpdatesBell />} />
              <Route path="/documents/:id" element={<div>페이지 화면</div>} />
              <Route path="/members" element={<div>팀원 화면</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
  }

  it("수정된 페이지 수를 종 아이콘에 표시하고, 누르면 목록에서 해당 페이지로 이동한다", async () => {
    vi.mocked(listDocumentUpdates).mockResolvedValue([update(11, "배포 절차"), update(14, "회의록")]);
    renderBell();

    expect(await screen.findByText("2")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("수정 알림"));
    expect(await screen.findByText("수정된 페이지")).toBeTruthy();
    expect(screen.getAllByText("스쿨북스 · 김동료 · 5분 전")).toHaveLength(2);

    fireEvent.click(screen.getByText(/배포 절차/));
    expect(await screen.findByText("페이지 화면")).toBeTruthy();
  });

  it("모두 읽음을 누르면 전체 확인 처리를 요청한다", async () => {
    vi.mocked(listDocumentUpdates).mockResolvedValue([update(11, "배포 절차")]);
    renderBell();
    fireEvent.click(await screen.findByLabelText("수정 알림"));
    fireEvent.click(await screen.findByText("모두 읽음"));
    await waitFor(() => expect(markAllDocumentUpdatesRead).toHaveBeenCalled());
  });

  it("수정된 페이지가 없으면 숫자 없이 안내 문구를 보여준다", async () => {
    vi.mocked(listDocumentUpdates).mockResolvedValue([]);
    renderBell();
    fireEvent.click(screen.getByLabelText("수정 알림"));
    expect(await screen.findByText("새로 수정된 페이지가 없습니다.")).toBeTruthy();
  });

  it("관리자는 가입 요청 건수를 함께 보고 팀원 화면으로 이동한다", async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ user: { id: 1, name: "관리자", active: true, admin: true }, me: null });
    vi.mocked(countPendingSignups).mockResolvedValue(2);
    vi.mocked(listDocumentUpdates).mockResolvedValue([update(11, "배포 절차")]);
    renderBell();
    expect(await screen.findByText("3")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("수정 알림"));
    fireEvent.click(await screen.findByText("가입 요청 2건"));
    expect(await screen.findByText("팀원 화면")).toBeTruthy();
  });

  it("일반 팀원은 가입 요청 수를 조회하지 않는다", async () => {
    vi.mocked(listDocumentUpdates).mockResolvedValue([]);
    renderBell();
    await waitFor(() => expect(listDocumentUpdates).toHaveBeenCalled());
    expect(countPendingSignups).not.toHaveBeenCalled();
  });
});

describe("updateFormat", () => {
  it("최상위 페이지 본문은 /spaces, 파일은 /files, 나머지는 /documents로 연결한다", () => {
    const spaces = [{ id: 1, name: "스쿨북스", description: null, documentCount: 1, homeDocumentId: 10, icon: null }];
    expect(updatePath(update(10, "스쿨북스"), spaces)).toBe("/spaces/1");
    expect(updatePath(update(15, "양식.xlsx", "FILE"), spaces)).toBe("/files/15");
    expect(updatePath(update(11, "배포 절차"), spaces)).toBe("/documents/11");
  });

  it("수정 시각을 방금 전·분·시간·일 단위로 짧게 표시한다", () => {
    const now = Date.parse("2026-11-05T10:00:00Z");
    expect(formatRelative("2026-11-05T09:59:30Z", now)).toBe("방금 전");
    expect(formatRelative("2026-11-05T09:15:00Z", now)).toBe("45분 전");
    expect(formatRelative("2026-11-05T07:00:00Z", now)).toBe("3시간 전");
    expect(formatRelative("2026-11-03T10:00:00Z", now)).toBe("2일 전");
  });
});
