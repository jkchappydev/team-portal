import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarMenuLink } from "./SidebarMenuLink";
import { CalendarIcon } from "./SidebarIcons";

function renderAt(path: string, ui: React.ReactNode) {
  render(
    <MantineProvider>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </MantineProvider>,
  );
}

describe("SidebarMenuLink", () => {
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

  it("페이지 트리 줄과 같은 22px 아이콘 칸에 선 아이콘(SVG)을 둔다", () => {
    renderAt("/", <SidebarMenuLink to="/work-status" label="근무 상황표" icon={<CalendarIcon />} />);
    const icon = document.querySelector("svg.sidebar-menu-icon");
    expect(icon?.closest(".tree-slot")).toBeTruthy();
    // 이모지가 아닌 SVG 아이콘이고, 화면 낭독기는 메뉴 이름만 읽음
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("근무 상황표")).toBeTruthy();
  });

  it("보고 있는 화면의 메뉴를 강조한다", () => {
    renderAt("/work-status", (
      <>
        <SidebarMenuLink to="/work-status" label="근무 상황표" icon={null} />
        <SidebarMenuLink to="/trash" label="휴지통" icon={null} />
      </>
    ));
    expect(screen.getByText("근무 상황표").closest("a")!.hasAttribute("data-active")).toBe(true);
    expect(screen.getByText("휴지통").closest("a")!.hasAttribute("data-active")).toBe(false);
  });

  it("주소가 없는 메뉴는 누르면 동작만 실행하는 버튼이다", () => {
    const onClick = vi.fn();
    renderAt("/", <SidebarMenuLink label="검색" icon={null} onClick={onClick} />);
    const button = screen.getByText("검색").closest("button")!;
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });
});
