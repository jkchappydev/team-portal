import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getMe } from "../api/auth";
import { ApiError } from "../api/client";
import { updateMember } from "../api/members";
import { AuthGate, CONNECTION_RETRY_MS, LoginPage, PENDING_RECHECK_MS, connectionErrorCode, pendingRecheckInterval } from "./AuthGate";

vi.mock("../api/auth", () => ({ getMe: vi.fn(), logout: vi.fn() }));
vi.mock("../api/members", async (importOriginal) => ({ ...(await importOriginal<typeof import("../api/members")>()), updateMember: vi.fn() }));

describe("AuthGate", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

  function renderGate() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MantineProvider><QueryClientProvider client={client}><AuthGate><div>포털 본문</div></AuthGate></QueryClientProvider></MantineProvider>);
  }

  it("로그인하지 않으면 구글 로그인 링크를 보여준다", async () => {
    vi.mocked(getMe).mockRejectedValue(new ApiError("UNAUTHENTICATED", "로그인 필요", 401));
    renderGate();
    expect((await screen.findByText("Google로 로그인")).closest("a")?.getAttribute("href")).toBe("/oauth2/authorization/google");
  });

  it("도메인 오류는 회사 계정 안내를 보여준다", () => {
    window.history.replaceState({}, "", "/login?error=domain");
    render(<MantineProvider><LoginPage /></MantineProvider>);
    expect(screen.getByText("회사 계정(@example.com)으로 로그인해 주세요")).toBeTruthy();
  });

  it.each([["PENDING", "승인 진행 중입니다"], ["REJECTED", "가입이 거절되었습니다. 관리자에게 문의하세요"]] as const)(
    "%s 상태와 이메일을 보여준다", async (status, message) => {
      vi.mocked(getMe).mockResolvedValue({ email: "a@example.com", status, memberId: null, memberName: null, admin: false });
      renderGate();
      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.getByText("a@example.com")).toBeTruthy();
    },
  );

  it("승인 대기 중에만 주기적으로 다시 확인한다", () => {
    const me = (status: "PENDING" | "APPROVED" | "REJECTED") => ({ email: "a@example.com", status, memberId: null, memberName: null, admin: false });
    expect(pendingRecheckInterval(me("PENDING"))).toBe(PENDING_RECHECK_MS);
    expect(pendingRecheckInterval(me("APPROVED"))).toBe(false);
    expect(pendingRecheckInterval(me("REJECTED"))).toBe(false);
    expect(pendingRecheckInterval(undefined)).toBe(false);
  });

  it("승인 대기 화면은 관리자가 승인하면 새로고침 없이 본문으로 바뀐다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(getMe)
        .mockResolvedValueOnce({ email: "a@example.com", status: "PENDING", memberId: null, memberName: null, admin: false })
        .mockResolvedValue({ email: "a@example.com", status: "APPROVED", memberId: 1, memberName: "팀원", admin: false });
      renderGate();
      expect(await screen.findByText("승인 진행 중입니다")).toBeTruthy();
      await vi.advanceTimersByTimeAsync(PENDING_RECHECK_MS);
      expect(await screen.findByText("포털 본문")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("승인된 사용자는 본문을 보고 비활성화되면 접근 차단 화면을 본다", async () => {
    vi.mocked(getMe)
      .mockResolvedValueOnce({ email: "a@example.com", status: "APPROVED", memberId: 1, memberName: "팀원", admin: false, active: true })
      .mockResolvedValue({ email: "a@example.com", status: "APPROVED", memberId: 1, memberName: "팀원", admin: false, active: false });
    renderGate();
    expect(await screen.findByText("포털 본문")).toBeTruthy();
    window.dispatchEvent(new CustomEvent("portal:auth-changed", { detail: "MEMBER_INACTIVE" }));
    expect(await screen.findByText("접근 권한이 없습니다")).toBeTruthy();
    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(2));
  });

  it("쓰는 중에 삭제되면 승인 대기로 바뀌고, 다시 승인되면 새로고침 없이 본문으로 돌아온다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(getMe)
        .mockResolvedValueOnce({ email: "a@example.com", status: "APPROVED", memberId: 1, memberName: "팀원", admin: false, active: true })
        .mockResolvedValueOnce({ email: "a@example.com", status: "PENDING", memberId: 1, memberName: "팀원", admin: false, active: false })
        .mockResolvedValue({ email: "a@example.com", status: "APPROVED", memberId: 1, memberName: "팀원", admin: false, active: true });
      renderGate();
      expect(await screen.findByText("포털 본문")).toBeTruthy();
      window.dispatchEvent(new CustomEvent("portal:auth-changed", { detail: "MEMBER_INACTIVE" }));
      expect(await screen.findByText("승인 진행 중입니다")).toBeTruthy();
      await vi.advanceTimersByTimeAsync(PENDING_RECHECK_MS);
      expect(await screen.findByText("포털 본문")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("승인 후 부서·직급을 입력하지 않았으면 내 정보 입력 화면을 거쳐 본문으로 들어간다", async () => {
    vi.mocked(getMe)
      .mockResolvedValueOnce({ email: "a@example.com", status: "APPROVED", memberId: 4, memberName: "홍길동", admin: false, active: true, profileComplete: false })
      .mockResolvedValue({ email: "a@example.com", status: "APPROVED", memberId: 4, memberName: "홍길동", admin: false, active: true, profileComplete: true });
    vi.mocked(updateMember).mockResolvedValue({ id: 4, name: "홍길동", active: true });
    renderGate();
    expect(await screen.findByText("내 정보 입력")).toBeTruthy();
    expect(screen.queryByText("포털 본문")).toBeNull();
    const start = screen.getByRole("button", { name: "시작하기" });
    expect(start.hasAttribute("disabled")).toBe(true);
    // 부서는 목록에서 고름 (우선 개발팀만)
    fireEvent.click(Array.from(document.querySelectorAll("[data-combobox-option]")).find((o) => o.textContent === "개발팀")!);
    const option = Array.from(document.querySelectorAll("[data-combobox-option]")).find((o) => o.textContent === "선임");
    fireEvent.click(option!);
    // 처음 가입한 사람도 숫자만 넣으면 하이픈이 붙고 내선번호는 3자리까지
    fireEvent.change(screen.getByLabelText(/^전화번호/), { target: { value: "01000000000" } });
    fireEvent.change(screen.getByLabelText(/^내선번호/), { target: { value: "3861" } });
    fireEvent.click(start);
    await waitFor(() => expect(updateMember).toHaveBeenCalledWith(4, { department: "개발팀", jobRank: "SENIOR", phone: "010-0000-0000", extension: "386" }));
    expect(await screen.findByText("포털 본문")).toBeTruthy();
  });

  it("서버에 연결하지 못하면 안내하고, 서버가 돌아오면 자동으로 본문을 보여준다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(getMe)
        .mockRejectedValueOnce(new ApiError("UNKNOWN_ERROR", "요청에 실패했습니다 (502)", 502))
        .mockResolvedValue({ email: "a@example.com", status: "APPROVED", memberId: 1, memberName: "팀원", admin: false, active: true });
      renderGate();
      expect(await screen.findByText("서버를 준비하는 중입니다")).toBeTruthy();
      expect(screen.getByText("502")).toBeTruthy();
      await vi.advanceTimersByTimeAsync(CONNECTION_RETRY_MS);
      expect(await screen.findByText("포털 본문")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("연결 실패는 Network Error, 서버 오류는 상태 코드로 보여준다", () => {
    expect(connectionErrorCode(new TypeError("Failed to fetch"))).toBe("Network Error");
    expect(connectionErrorCode(new ApiError("INTERNAL_ERROR", "", 500))).toBe("500");
  });

  it("이미 본문을 보던 중 로그인 정보 확인이 잠깐 실패해도 본문을 그대로 둔다", async () => {
    vi.mocked(getMe)
      .mockResolvedValueOnce({ email: "a@example.com", status: "APPROVED", memberId: 1, memberName: "팀원", admin: false, active: true })
      .mockRejectedValue(new TypeError("Failed to fetch"));
    renderGate();
    expect(await screen.findByText("포털 본문")).toBeTruthy();
    window.dispatchEvent(new CustomEvent("portal:auth-changed"));
    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(2));
    expect(screen.getByText("포털 본문")).toBeTruthy();
    expect(screen.queryByText("서버에 연결하지 못했습니다")).toBeNull();
  });
});
