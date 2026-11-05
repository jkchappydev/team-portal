import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMe } from "../api/auth";
import { AdminRoute } from "./AdminRoute";

vi.mock("../api/auth", () => ({ getMe: vi.fn(), logout: vi.fn() }));

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/members" element={<AdminRoute><div>팀원 관리 화면</div></AdminRoute>} />
          <Route path="/work-status" element={<div>근무 상황표 화면</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminRoute", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);

  it("관리자는 팀원 관리 화면을 본다", async () => {
    vi.mocked(getMe).mockResolvedValue({ email: "a@example.com", status: "APPROVED", memberId: 1, memberName: "관리자", admin: true });
    renderAt("/members");
    expect(await screen.findByText("팀원 관리 화면")).toBeTruthy();
  });

  it("관리자가 아니면 주소로 들어와도 근무 상황표로 돌려보낸다", async () => {
    vi.mocked(getMe).mockResolvedValue({ email: "b@example.com", status: "APPROVED", memberId: 2, memberName: "팀원", admin: false });
    renderAt("/members");
    expect(await screen.findByText("근무 상황표 화면")).toBeTruthy();
    expect(screen.queryByText("팀원 관리 화면")).toBeNull();
  });
});
