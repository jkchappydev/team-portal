import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Menu, MantineProvider } from "@mantine/core";
import { PrintMenuItem } from "./PrintMenuItem";

describe("PrintMenuItem", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  it("인쇄를 누르면 브라우저 인쇄 창을 연다", () => {
    vi.useFakeTimers();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(
      <MantineProvider>
        <Menu opened>
          <Menu.Target><button>메뉴</button></Menu.Target>
          <Menu.Dropdown><PrintMenuItem /></Menu.Dropdown>
        </Menu>
      </MantineProvider>,
    );

    fireEvent.click(screen.getByText("인쇄"));
    vi.runAllTimers();

    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
    vi.useRealTimers();
  });
});
