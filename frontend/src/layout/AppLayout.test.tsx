import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppLayout } from "./AppLayout";

vi.mock("../user/currentUser", () => ({ useCurrentUser: () => ({ user: { id: 1, name: "테스트" } }) }));
vi.mock("../home/NewCsToasts", () => ({ NewCsToasts: () => null }));
vi.mock("./Sidebar", () => ({ Sidebar: () => <Link to="/contacts">외부 연락처</Link> }));

describe("AppLayout 좁은 화면 메뉴", () => {
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
  });

  afterEach(cleanup);

  it("메뉴 버튼으로 사이드바를 열고, 다른 화면으로 옮기면 다시 닫는다", () => {
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<p>메인 본문</p>} />
              <Route path="/contacts" element={<p>연락처 본문</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
    expect(screen.getByRole("button", { name: "메뉴 닫기" })).toBeTruthy();

    fireEvent.click(screen.getByText("외부 연락처"));
    expect(screen.getByText("연락처 본문")).toBeTruthy();
    expect(screen.getByRole("button", { name: "메뉴 열기" })).toBeTruthy();
  });
});
