import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { approveSignup, listSignupRequests, rejectSignup, setMemberDeveloper } from "../api/admin";
import { deleteMember, listMembers, moveMember, updateMember } from "../api/members";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useCurrentUser } from "../user/currentUser";
import { MembersPage } from "./MembersPage";

vi.mock("../api/admin", () => ({ listSignupRequests: vi.fn(), approveSignup: vi.fn(), rejectSignup: vi.fn(), reopenSignup: vi.fn(), setMemberAdmin: vi.fn(), setMemberDeveloper: vi.fn() }));
vi.mock("../api/members", async (importOriginal) => ({ ...(await importOriginal<typeof import("../api/members")>()), listMembers: vi.fn(), updateMember: vi.fn(), moveMember: vi.fn(), deleteMember: vi.fn() }));
vi.mock("../user/currentUser", () => ({ useCurrentUser: vi.fn() }));

describe("팀원 관리", () => {
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
    vi.mocked(updateMember).mockResolvedValue({ id: 1, name: "기존 팀원", active: false });
  });
  afterEach(cleanup);

  function renderPage(mode: "manage" | "list" = "manage") {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[mode === "list" ? "/team" : "/members"]}>
            <Routes>
              <Route path="/members" element={<MembersPage />} />
              <Route path="/team" element={<MembersPage mode="list" />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
  }

  // 열린 선택 목록에서 항목 고르기 (Mantine Select는 목록을 미리 그려 둠)
  function pickOption(label: string) {
    const option = Array.from(document.querySelectorAll("[data-combobox-option]")).find((o) => o.textContent === label);
    expect(option).toBeTruthy();
    fireEvent.click(option!);
  }

  it("관리자는 부서·직급 없이 구글 이름을 기본값으로 새 팀원 승인만 한다", async () => {
    renderPage();
    expect(await screen.findByDisplayValue("홍길동")).toBeTruthy();
    expect(screen.queryByLabelText("부서")).toBeNull();
    expect(screen.queryByLabelText("직급")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() => expect(approveSignup).toHaveBeenCalledWith(5, { newMemberName: "홍길동" }));
  });

  it("이름을 비우면 새 팀원으로 승인할 수 없다", async () => {
    renderPage();
    fireEvent.change(await screen.findByDisplayValue("홍길동"), { target: { value: " " } });
    expect(screen.getByRole("button", { name: "승인" }).hasAttribute("disabled")).toBe(true);
  });

  it("기존 팀원과 연결은 연결되지 않은 활성 팀원만 고를 수 있다", async () => {
    vi.mocked(listMembers).mockResolvedValue([
      { id: 1, name: "연결 가능", active: true, email: null },
      { id: 2, name: "이미 연결됨", active: true, email: "b@example.com" },
      { id: 3, name: "비활성", active: false, email: null },
    ]);
    renderPage();
    await screen.findByText("연결 가능");
    fireEvent.click(screen.getByText("기존 팀원과 연결"));
    const labels = Array.from(document.querySelectorAll("[data-combobox-option]")).map((o) => o.textContent);
    expect(labels).not.toContain("이미 연결됨");
    expect(labels).not.toContain("비활성");
    pickOption("연결 가능");
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() => expect(approveSignup).toHaveBeenCalledWith(5, { memberId: 1 }));
  });

  it("거절은 확인한 후 처리한다", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "거절" }));
    expect(rejectSignup).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "거절" }));
    await waitFor(() => expect(rejectSignup).toHaveBeenCalledWith(5));
  });

  it("새 팀원을 직접 추가하는 입력은 없다", async () => {
    renderPage();
    await screen.findByText("기존 팀원");
    expect(screen.queryByText("새 팀원")).toBeNull();
    expect(screen.queryByRole("button", { name: "추가" })).toBeNull();
  });

  it("상태 열 없이 활성 팀원 메뉴에는 다시 활성화가 없다", async () => {
    renderPage();
    await screen.findByText("기존 팀원");
    expect(screen.queryByText("상태")).toBeNull();
    fireEvent.click(screen.getByLabelText("기존 팀원 메뉴"));
    await screen.findByText("정보 수정");
    expect(screen.queryByText("다시 활성화")).toBeNull();
  });

  it("예전에 비활성으로 바꾼 팀원은 ⋯ 메뉴에서 다시 활성화한다", async () => {
    vi.mocked(listMembers).mockResolvedValue([{ id: 1, name: "기존 팀원", active: false, email: null }]);
    renderPage();
    fireEvent.click(await screen.findByLabelText("기존 팀원 메뉴"));
    fireEvent.click(await screen.findByText("다시 활성화"));
    await waitFor(() => expect(updateMember).toHaveBeenCalledWith(1, { active: true }));
  });

  it("삭제했던 팀원의 재가입은 기본으로 이전 기록에 다시 연결해 승인한다", async () => {
    vi.mocked(listSignupRequests).mockResolvedValue([{
      id: 7, googleName: "이재구", email: "lee@example.com", status: "PENDING", requestedAt: "2026-11-05T00:00:00Z",
      previousMemberId: 3, previousMemberName: "이재구", previousDepartment: "개발팀", previousJobRank: "RESPONSIBLE",
    }]);
    renderPage();
    expect(await screen.findByText("재가입")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() => expect(approveSignup).toHaveBeenCalledWith(7, { memberId: 3 }));
  });

  it("⋯ 메뉴의 정보 수정 창에서 이름은 보여주기만 하고 부서·직급·연락처를 저장한다", async () => {
    vi.mocked(listMembers).mockResolvedValue([{ id: 1, name: "기존 팀원", active: true, email: null, department: "개발팀", jobRank: "SENIOR" }]);
    renderPage();
    fireEvent.click(await screen.findByLabelText("기존 팀원 메뉴"));
    fireEvent.click(await screen.findByText("정보 수정"));
    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByLabelText("이름") as HTMLInputElement).readOnly).toBe(true);
    pickOption("개발팀");
    // 전화번호·내선번호는 필수라 비어 있으면 저장할 수 없음
    expect(within(dialog).getByRole("button", { name: "저장" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/^전화번호/), { target: { value: "01012345678" } });
    fireEvent.change(within(dialog).getByLabelText(/^내선번호/), { target: { value: "123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(updateMember).toHaveBeenCalledWith(1, { department: "개발팀", jobRank: "SENIOR", phone: "010-1234-5678", extension: "123" }));
  });

  it("⋯ 메뉴의 팀원 삭제는 확인 후 처리하고, 본인 줄에는 삭제 메뉴가 없다", async () => {
    vi.mocked(listMembers).mockResolvedValue([
      { id: 1, name: "관리자", active: true, email: null, admin: true },
      { id: 2, name: "퇴사자", active: true, email: null },
    ]);
    vi.mocked(deleteMember).mockResolvedValue();
    renderPage();
    fireEvent.click(await screen.findByLabelText("관리자 메뉴"));
    await screen.findByText("정보 수정");
    expect(screen.queryByText("팀원 삭제")).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    fireEvent.click(screen.getByLabelText("퇴사자 메뉴"));
    fireEvent.click(await screen.findByText("팀원 삭제"));
    expect(deleteMember).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteMember).toHaveBeenCalledWith(2));
  });

  it("끌어서 팀원 순서를 바꾼다", async () => {
    vi.mocked(listMembers).mockResolvedValue([
      { id: 1, name: "첫째", active: true, email: null },
      { id: 2, name: "둘째", active: true, email: null },
    ]);
    vi.mocked(moveMember).mockResolvedValue();
    renderPage();
    const handle = await screen.findByLabelText("둘째 순서 변경");
    const target = screen.getByText("첫째").closest("tr")!;
    const dataTransfer = { clearData: vi.fn(), setData: vi.fn(), effectAllowed: "move" };
    fireEvent.dragStart(handle, { dataTransfer });
    fireEvent.dragOver(target, { clientY: -1, dataTransfer });
    expect(target.getAttribute("data-member-drop")).toBe("before");
    fireEvent.drop(target, { clientY: -1, dataTransfer });
    await waitFor(() => expect(moveMember).toHaveBeenCalledWith(2, 1));
  });

  it("일반 팀원은 목록을 보고 본인 정보만 고칠 수 있다", async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ user: { id: 2, name: "팀원", active: true, admin: false }, me: null });
    vi.mocked(listMembers).mockResolvedValue([
      { id: 1, name: "김관리", active: true, email: null, admin: true },
      { id: 2, name: "팀원", active: true, email: null, department: "개발팀", jobRank: "SENIOR", phone: "010-1111-2222", extension: "12" },
    ]);
    vi.mocked(updateMember).mockResolvedValue({ id: 2, name: "팀원", active: true });
    renderPage("list");

    expect(await screen.findByText("김관리")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "팀원 목록" })).toBeTruthy();
    expect(screen.queryByText("가입 요청")).toBeNull();
    expect(listSignupRequests).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("팀원 순서 변경")).toBeNull();
    expect(screen.queryByLabelText("김관리 메뉴")).toBeNull();

    fireEvent.click(screen.getByLabelText("팀원 메뉴"));
    fireEvent.click(await screen.findByText("정보 수정"));
    expect(screen.queryByText("관리자 권한 주기")).toBeNull();
    expect(screen.queryByText("팀원 삭제")).toBeNull();
    const dialog = await screen.findByRole("dialog");
    pickOption("개발팀");
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(updateMember).toHaveBeenCalledWith(2, { department: "개발팀", jobRank: "SENIOR", phone: "010-1111-2222", extension: "12" }));
  });

  it("관리자도 팀원 목록에서는 끌기·가입 요청 없이 본인 줄만 고친다", async () => {
    vi.mocked(listMembers).mockResolvedValue([
      { id: 1, name: "관리자", active: true, email: null, admin: true },
      { id: 2, name: "팀원", active: true, email: null },
    ]);
    renderPage("list");

    expect(await screen.findByLabelText("관리자 메뉴")).toBeTruthy();
    expect(screen.queryByText("가입 요청")).toBeNull();
    expect(screen.queryByLabelText("관리자 순서 변경")).toBeNull();
    expect(screen.queryByText("드래그로 순서를 변경할 수 있습니다.")).toBeNull();
    expect(screen.getByLabelText("관리자 메뉴")).toBeTruthy();
    expect(screen.queryByLabelText("팀원 메뉴")).toBeNull();
  });

  it("관리자가 아니면 팀원 관리 주소로 와도 팀원 목록으로 보낸다", async () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      user: { id: 2, name: "팀원", active: true, admin: false },
      me: { email: "b@example.com", status: "APPROVED", memberId: 2, memberName: "팀원", admin: false },
    });
    renderPage("manage");
    expect(await screen.findByRole("heading", { name: "팀원 목록" })).toBeTruthy();
  });

  it("개발자 권한은 권한 칸에 개발자로 보이고 권한 변경·삭제 메뉴가 없다", async () => {
    vi.mocked(listMembers).mockResolvedValue([
      { id: 1, name: "관리자", active: true, email: null, admin: true },
      { id: 2, name: "개발팀원", active: true, email: null, admin: true, developer: true, jobRank: "RESPONSIBLE" },
    ]);
    renderPage();
    expect(await screen.findByText("개발자")).toBeTruthy();
    expect(screen.getByText("책임")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("개발팀원 메뉴"));
    expect(await screen.findByText("정보 수정")).toBeTruthy();
    expect(screen.queryByText("관리자 권한 제거")).toBeNull();
    expect(screen.queryByText("팀원 삭제")).toBeNull();
    // 관리자여도 개발자가 아니면 개발자 권한 메뉴가 없음
    expect(screen.queryByText("개발자 권한 제거")).toBeNull();
  });

  it("개발자는 다른 팀원에게 개발자 권한을 주거나 뺄 수 있다", async () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      user: { id: 1, name: "개발자", active: true, admin: true, developer: true }, me: null,
    });
    vi.mocked(listMembers).mockResolvedValue([
      { id: 1, name: "개발자", active: true, email: null, admin: true, developer: true },
      { id: 2, name: "팀원", active: true, email: null },
    ]);
    vi.mocked(setMemberDeveloper).mockResolvedValue({ id: 2, name: "팀원", active: true });
    renderPage();
    fireEvent.click(await screen.findByLabelText("팀원 메뉴"));
    fireEvent.click(await screen.findByText("개발자 권한 주기"));
    await waitFor(() => expect(setMemberDeveloper).toHaveBeenCalledWith(2, true));
  });

  it("전화번호를 목록에 보여주고 정보 수정 창에서 고친다", async () => {
    vi.mocked(listMembers).mockResolvedValue([{ id: 1, name: "기존 팀원", active: true, email: null, department: "개발팀", jobRank: "SENIOR", phone: "010-1111-2222", extension: "12" }]);
    renderPage();
    expect(await screen.findByText("010-1111-2222")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("기존 팀원 메뉴"));
    fireEvent.click(await screen.findByText("정보 수정"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^전화번호/), { target: { value: " 010-3333-4444 " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(updateMember).toHaveBeenCalledWith(1, { department: "개발팀", jobRank: "SENIOR", phone: "010-3333-4444", extension: "12" }));
  });

  it("내선번호를 목록에 보여주고 정보 수정 창에서 고친다", async () => {
    vi.mocked(listMembers).mockResolvedValue([{ id: 1, name: "기존 팀원", active: true, email: null, department: "개발팀", jobRank: "SENIOR", phone: "010-1111-2222", extension: "1234" }]);
    renderPage();
    expect(await screen.findByText("1234")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "내선번호" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("기존 팀원 메뉴"));
    fireEvent.click(await screen.findByText("정보 수정"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^내선번호/), { target: { value: " 5678 " } });
    expect((within(dialog).getByLabelText(/^내선번호/) as HTMLInputElement).value).toBe("567");
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(updateMember).toHaveBeenCalledWith(1, { department: "개발팀", jobRank: "SENIOR", phone: "010-1111-2222", extension: "567" }));
  });
});
