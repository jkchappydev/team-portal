import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { updateMember } from "../api/members";
import { useCurrentUser } from "./currentUser";
import { ProfileSetupPreview } from "./ProfileSetup";

vi.mock("../api/members", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/members")>()), updateMember: vi.fn(),
}));
vi.mock("./currentUser", () => ({ useCurrentUser: vi.fn() }));

const me = { email: "a@example.com", status: "APPROVED" as const, memberId: 2, memberName: "홍길동", admin: true };

function renderPreview() {
  render(
    <MantineProvider>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/preview/profile-setup"]}>
          <Routes>
            <Route path="/preview/profile-setup" element={<ProfileSetupPreview />} />
            <Route path="/team" element={<div>팀원 목록 화면</div>} />
            <Route path="/work-status" element={<div>근무 상황표 화면</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("최초 가입 정보 입력 미리보기", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("개발자는 화면을 보고, 시작하기를 눌러도 저장하지 않고 팀원 목록으로 돌아간다", async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ user: { id: 2, name: "홍길동", active: true, developer: true }, me });
    renderPreview();
    expect(screen.getByText("내 정보 입력")).toBeTruthy();
    expect(screen.getByText("미리보기 화면입니다. 입력해도 저장되지 않습니다.")).toBeTruthy();

    fireEvent.click(Array.from(document.querySelectorAll("[data-combobox-option]")).find((o) => o.textContent === "개발팀")!);
    fireEvent.click(Array.from(document.querySelectorAll("[data-combobox-option]")).find((o) => o.textContent === "선임")!);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    expect(await screen.findByText("팀원 목록 화면")).toBeTruthy();
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("개발자가 아니면 근무 상황표로 보낸다", async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ user: { id: 2, name: "홍길동", active: true, admin: true }, me });
    renderPreview();
    expect(await screen.findByText("근무 상황표 화면")).toBeTruthy();
  });
});
