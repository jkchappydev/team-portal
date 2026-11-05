import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getMe } from "../api/auth";
import { ApiError } from "../api/client";
import { AuthGate, LoginPage } from "./AuthGate";

vi.mock("../api/auth", () => ({ getMe: vi.fn(), logout: vi.fn() }));

describe("AuthGate", () => {
  beforeAll(() => {
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

  it("승인된 사용자는 본문을 보고 비활성화되면 접근 차단 화면을 본다", async () => {
    vi.mocked(getMe).mockResolvedValue({ email: "a@example.com", status: "APPROVED", memberId: 1, memberName: "팀원", admin: false });
    renderGate();
    expect(await screen.findByText("포털 본문")).toBeTruthy();
    window.dispatchEvent(new CustomEvent("portal:auth-changed", { detail: "MEMBER_INACTIVE" }));
    expect(await screen.findByText("접근 권한이 없습니다")).toBeTruthy();
    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(2));
  });
});
