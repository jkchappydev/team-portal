import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppLayout } from "./AppLayout";

vi.mock("../user/currentUser", () => ({ useCurrentUser: () => ({ user: { id: 1, name: "테스트" } }) }));
vi.mock("../home/NewCsToasts", () => ({ NewCsToasts: () => null }));
vi.mock("../notifications/DocumentUpdatesBell", () => ({ DocumentUpdatesBell: () => <button type="button">수정 알림</button> }));
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

  it("좁은 화면은 위쪽 줄에 포털 이름(메인으로 가는 링크)과 수정 알림을 둔다", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes("max-width"), media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      render(
        <MantineProvider>
          <MemoryRouter initialEntries={["/contacts"]}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<p>메인 본문</p>} />
                <Route path="/contacts" element={<p>연락처 본문</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </MantineProvider>,
      );
      const header = screen.getByRole("banner");
      expect(within(header).getByRole("button", { name: "수정 알림" })).toBeTruthy();
      fireEvent.click(within(header).getByText("개발팀"));
      expect(screen.getByText("메인 본문")).toBeTruthy();
    } finally {
      window.matchMedia = original;
    }
  });

  it("좁은 화면에서 사이드바를 열면 본문을 어둡게 덮고 스크롤을 잠그며, 덮개를 누르면 닫고 풀린다", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes("max-width"), media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      render(
        <MantineProvider>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<p>메인 본문</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </MantineProvider>,
      );
      expect(screen.queryByTestId("nav-overlay")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
      // 열려 있는 동안 덮인 본문(페이지) 스크롤 잠금
      expect(document.documentElement.style.overflow).toBe("hidden");
      fireEvent.click(await screen.findByTestId("nav-overlay"));
      expect(screen.getByRole("button", { name: "메뉴 열기" })).toBeTruthy();
      expect(document.documentElement.style.overflow).toBe("");
    } finally {
      window.matchMedia = original;
    }
  });
});
