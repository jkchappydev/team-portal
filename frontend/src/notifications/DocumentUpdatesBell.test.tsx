import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentUpdatesBell } from "./DocumentUpdatesBell";
import {
  listDocumentUpdates, listWorkStatusNotices, markAllDocumentUpdatesRead, markAllWorkStatusNoticesRead, markWorkStatusNoticeRead,
} from "../api/notifications";
import { formatRelative, isProjectHome, updatePath } from "./updateFormat";
import type { SpaceDto } from "../api/spaces";
import { useCurrentUser } from "../user/currentUser";
import { countPendingSignups } from "../api/admin";

const update = (id: number, title: string, kind: "PAGE" | "FILE" = "PAGE", mentioned = false) => ({
  id, spaceId: 1, spaceName: "스쿨북스", title, icon: null, updatedByName: "김동료",
  updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(), parentId: null, kind, fileUrl: null, mentioned,
});

vi.mock("../api/notifications", () => ({
  listDocumentUpdates: vi.fn(),
  markAllDocumentUpdatesRead: vi.fn(() => Promise.resolve()),
  listWorkStatusNotices: vi.fn(),
  markWorkStatusNoticeRead: vi.fn(() => Promise.resolve()),
  markAllWorkStatusNoticesRead: vi.fn(() => Promise.resolve()),
}));

const notice = (id: number, label: string, action: "CREATED" | "UPDATED" | "DELETED" = "CREATED") => ({
  id, action, label, startDate: "2026-12-03", endDate: "2026-12-04", actorName: "김동료",
  createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
});

// 이동한 근무 상황표 주소 확인용
function WorkStatusRoute() {
  const location = useLocation();
  return <div>근무 상황표 {location.search}</div>;
}
vi.mock("../api/spaces", () => ({
  listSpaces: () => Promise.resolve([{ id: 1, name: "스쿨북스", description: null, documentCount: 1, homeDocumentId: 10, kind: "PROJECT", icon: null, cover: null }]),
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
    vi.mocked(listWorkStatusNotices).mockResolvedValue({ enabled: false, items: [] });
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
              <Route path="/work-status" element={<WorkStatusRoute />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
    return queryClient;
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

  it("@언급으로 온 알림에는 나를 언급 표시를 붙인다", async () => {
    vi.mocked(listDocumentUpdates).mockResolvedValue([update(11, "배포 절차", "PAGE", true), update(14, "회의록")]);
    renderBell();

    fireEvent.click(await screen.findByLabelText("수정 알림"));
    expect(await screen.findByText(/@나를 언급/)).toBeTruthy();
    expect(screen.getAllByText(/@나를 언급/)).toHaveLength(1);
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

  it("처음 열 때는 종을 흔들지 않고, 이후 새 알림이 늘어나면 한 번 흔든다", async () => {
    vi.mocked(listDocumentUpdates).mockResolvedValue([update(11, "배포 절차")]);
    const queryClient = renderBell();
    expect(await screen.findByText("1")).toBeTruthy();
    const bell = () => screen.getByLabelText("수정 알림").querySelector("svg")!;
    expect(bell().hasAttribute("data-ring")).toBe(false);

    vi.mocked(listDocumentUpdates).mockResolvedValue([update(11, "배포 절차"), update(14, "회의록")]);
    await queryClient.refetchQueries();
    await waitFor(() => expect(bell().hasAttribute("data-ring")).toBe(true));
  });

  it("팀장 이상·개발자는 수정된 페이지 위에 근무 상황 변경을 보고, 누르면 확인 처리 후 그 달 근무 상황표로 이동한다", async () => {
    vi.mocked(listWorkStatusNotices).mockResolvedValue({ enabled: true, items: [notice(5, "홍길동 연차"), notice(6, "이순신 출장", "DELETED")] });
    vi.mocked(listDocumentUpdates).mockResolvedValue([update(11, "배포 절차")]);
    renderBell();

    expect(await screen.findByText("3")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("수정 알림"));
    const sectionTitle = await screen.findByText("근무 상황 변경");
    // 근무 상황 변경 칸이 수정된 페이지보다 위
    expect(sectionTitle.compareDocumentPosition(screen.getByText("수정된 페이지")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("삭제")).toBeTruthy();
    expect(screen.getAllByText("12/3(목) ~ 12/4(금) · 김동료 · 2분 전")).toHaveLength(2);

    fireEvent.click(screen.getByText("홍길동 연차"));
    expect(await screen.findByText("근무 상황표 ?month=2026-12")).toBeTruthy();
    await waitFor(() => expect(markWorkStatusNoticeRead).toHaveBeenCalledWith(5, expect.anything()));
  });

  it("근무 상황 변경 모두 읽음은 근무 상황 알림만 확인 처리한다", async () => {
    vi.mocked(listWorkStatusNotices).mockResolvedValue({ enabled: true, items: [notice(5, "홍길동 연차")] });
    vi.mocked(listDocumentUpdates).mockResolvedValue([]);
    renderBell();
    fireEvent.click(await screen.findByLabelText("수정 알림"));
    await screen.findByText("홍길동 연차");
    fireEvent.click(screen.getAllByText("모두 읽음")[0]);
    await waitFor(() => expect(markAllWorkStatusNoticesRead).toHaveBeenCalled());
    expect(markAllDocumentUpdatesRead).not.toHaveBeenCalled();
  });

  it("알림 대상이 아니면 근무 상황 변경 칸을 보이지 않는다", async () => {
    vi.mocked(listDocumentUpdates).mockResolvedValue([]);
    renderBell();
    fireEvent.click(screen.getByLabelText("수정 알림"));
    expect(await screen.findByText("수정된 페이지")).toBeTruthy();
    expect(screen.queryByText("근무 상황 변경")).toBeNull();
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
    const spaces: SpaceDto[] = [
      { id: 1, name: "스쿨북스", description: null, documentCount: 1, homeDocumentId: 10, kind: "PROJECT", icon: null, cover: null },
      { id: 2, name: "메모", description: null, documentCount: 1, homeDocumentId: 20, kind: "PAGE", icon: null, cover: null },
    ];
    expect(updatePath(update(10, "스쿨북스"), spaces)).toBe("/spaces/1");
    expect(updatePath(update(15, "양식.xlsx", "FILE"), spaces)).toBe("/files/15");
    expect(updatePath(update(11, "배포 절차"), spaces)).toBe("/documents/11");
    // 최상위 페이지 본문도 /spaces로 열지만 폴더 아이콘은 프로젝트 본문만
    expect(updatePath({ ...update(20, "메모"), spaceId: 2 }, spaces)).toBe("/spaces/2");
    expect(isProjectHome(update(10, "스쿨북스"), spaces)).toBe(true);
    expect(isProjectHome(update(20, "메모"), spaces)).toBe(false);
  });

  it("수정 시각을 방금 전·분·시간·일 단위로 짧게 표시한다", () => {
    const now = Date.parse("2026-11-05T10:00:00Z");
    expect(formatRelative("2026-11-05T09:59:30Z", now)).toBe("방금 전");
    expect(formatRelative("2026-11-05T09:15:00Z", now)).toBe("45분 전");
    expect(formatRelative("2026-11-05T07:00:00Z", now)).toBe("3시간 전");
    expect(formatRelative("2026-11-03T10:00:00Z", now)).toBe("2일 전");
  });
});
