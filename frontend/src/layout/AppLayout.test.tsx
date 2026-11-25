import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppLayout } from "./AppLayout";

vi.mock("../user/currentUser", () => ({ useCurrentUser: () => ({ user: { id: 1, name: "테스트" } }) }));
vi.mock("../home/NewCsToasts", () => ({ NewCsToasts: () => null }));
vi.mock("../notifications/DocumentUpdatesBell", () => ({ DocumentUpdatesBell: () => <button type="button">수정 알림</button> }));
vi.mock("./Sidebar", () => ({ Sidebar: () => <Link to="/contacts">외부 연락처</Link> }));
vi.mock("../documents/SearchDialog", () => ({ SearchDialog: ({ opened }: { opened: boolean }) => (opened ? <p>검색 창</p> : null) }));
vi.mock("../user/ProfileSettingsModal", () => ({ ProfileSettingsModal: ({ opened }: { opened: boolean }) => (opened ? <p>설정 창</p> : null) }));

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

  it("좁은 화면은 메뉴 버튼으로 사이드바를 열고, 다른 화면으로 옮기면 다시 닫는다", () => {
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
    } finally {
      window.matchMedia = original;
    }
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

  it("넓은 화면도 위쪽 줄에 포털 이름·검색·수정 알림·내 정보를 두고, 메뉴 버튼은 두지 않는다", async () => {
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
    expect(within(header).queryByRole("button", { name: "메뉴 열기" })).toBeNull();
    expect(within(header).getByRole("button", { name: "수정 알림" })).toBeTruthy();
    expect(within(header).getByText("개발팀")).toBeTruthy();

    // 검색 칸을 누르면 검색 창
    fireEvent.click(within(header).getByRole("button", { name: "검색" }));
    expect(screen.getByText("검색 창")).toBeTruthy();

    // 내 정보를 누르면 설정·로그아웃 메뉴, 설정을 고르면 설정 창
    fireEvent.click(within(header).getByRole("button", { name: "내 정보" }));
    // jsdom은 레이아웃이 없어 Mantine이 위쪽 줄 안 기준 버튼을 가려진 것으로 보고 펼친 메뉴를 display: none으로 둠 (실제 브라우저는 보임)
    expect(await screen.findByRole("menuitem", { name: "로그아웃", hidden: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "설정", hidden: true }));
    expect(screen.getByText("설정 창")).toBeTruthy();
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
