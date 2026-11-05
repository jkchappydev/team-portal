import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { approveSignup, listSignupRequests, rejectSignup } from "../api/admin";
import { listMembers, moveMember } from "../api/members";
import { useCurrentUser } from "../user/currentUser";
import { MembersPage } from "./MembersPage";

vi.mock("../api/admin", () => ({ listSignupRequests: vi.fn(), approveSignup: vi.fn(), rejectSignup: vi.fn(), reopenSignup: vi.fn(), setMemberAdmin: vi.fn() }));
vi.mock("../api/members", async (importOriginal) => ({ ...(await importOriginal<typeof import("../api/members")>()), listMembers: vi.fn(), createMember: vi.fn(), updateMember: vi.fn(), moveMember: vi.fn() }));
vi.mock("../user/currentUser", () => ({ useCurrentUser: vi.fn() }));

describe("가입 요청 관리", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useCurrentUser).mockReturnValue({ user: { id: 1, name: "관리자", active: true, admin: true }, me: null });
    vi.mocked(listMembers).mockResolvedValue([{ id: 1, name: "기존 팀원", active: true, email: null }]);
    vi.mocked(listSignupRequests).mockResolvedValue([{ id: 5, googleName: "홍길동", email: "a@example.com", status: "PENDING", requestedAt: "2026-11-05T00:00:00Z" }]);
    vi.mocked(approveSignup).mockResolvedValue();
    vi.mocked(rejectSignup).mockResolvedValue();
  });
  afterEach(cleanup);

  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MantineProvider><QueryClientProvider client={client}><MembersPage /></QueryClientProvider></MantineProvider>);
  }

  async function fillOrganization() {
    fireEvent.change(await screen.findByLabelText("부서"), { target: { value: "개발팀" } });
    const rank = Array.from(document.querySelectorAll("[data-combobox-option]"))
      .find((option) => option.textContent === "선임");
    expect(rank).toBeTruthy();
    fireEvent.click(rank!);
  }

  it("관리자가 구글 이름을 기본값으로 새 팀원 승인", async () => {
    renderPage();
    await fillOrganization();
    fireEvent.click(await screen.findByText("새 팀원으로 등록"));
    await waitFor(() => expect(approveSignup).toHaveBeenCalledWith(5, { newMemberName: "홍길동", department: "개발팀", jobRank: "SENIOR" }));
  });

  it("연결되지 않은 활성 팀원만 골라 기존 팀원으로 승인한다", async () => {
    vi.mocked(listMembers).mockResolvedValue([
      { id: 1, name: "연결 가능", active: true, email: null },
      { id: 2, name: "이미 연결됨", active: true, email: "b@example.com" },
      { id: 3, name: "비활성", active: false, email: null },
    ]);
    renderPage();
    await screen.findByDisplayValue("연결 가능");
    await fillOrganization();
    const options = Array.from(document.querySelectorAll("[data-combobox-option]"));
    expect(options.map((option) => option.textContent)).not.toContain("이미 연결됨");
    expect(options.map((option) => option.textContent)).not.toContain("비활성");
    fireEvent.click(options.find((option) => option.textContent === "연결 가능")!);
    fireEvent.click(screen.getByText("기존 팀원과 연결"));
    await waitFor(() => expect(approveSignup).toHaveBeenCalledWith(5, { memberId: 1, department: "개발팀", jobRank: "SENIOR" }));
  });

  it("거절은 확인한 후 처리한다", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("거절"));
    expect(rejectSignup).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "거절" }));
    await waitFor(() => expect(rejectSignup).toHaveBeenCalledWith(5));
  });

  it("일반 팀원에게 변경 기능을 보여주지 않는다", async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ user: { id: 1, name: "팀원", active: true, admin: false }, me: null });
    renderPage();
    expect(await screen.findByText("기존 팀원")).toBeTruthy();
    expect(screen.queryByText("가입 요청")).toBeNull();
    expect(screen.queryByText("추가")).toBeNull();
    expect(listSignupRequests).not.toHaveBeenCalled();
  });

  it("관리자는 팀원 관리에서도 같은 순서를 변경할 수 있다", async () => {
    vi.mocked(listMembers).mockResolvedValue([
      { id: 1, name: "첫째", active: true, email: null },
      { id: 2, name: "둘째", active: true, email: null },
    ]);
    vi.mocked(moveMember).mockResolvedValue();
    renderPage();
    const handle = await screen.findByLabelText("둘째 순서 변경");
    const target = screen.getByDisplayValue("첫째").closest("tr")!;
    const dataTransfer = { clearData: vi.fn(), setData: vi.fn(), effectAllowed: "move" };
    fireEvent.dragStart(handle, { dataTransfer });
    fireEvent.dragOver(target, { clientY: -1, dataTransfer });
    expect(target.getAttribute("data-member-drop")).toBe("before");
    fireEvent.drop(target, { clientY: -1, dataTransfer });
    await waitFor(() => expect(moveMember).toHaveBeenCalledWith(2, 1));
  });
});
