import { Button, MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { IconPicker } from "./IconPicker";

function renderPicker(hasIcon: boolean, onSelect: (icon: string | null) => void) {
  render(
    <MantineProvider>
      <IconPicker
        hasIcon={hasIcon}
        onSelect={onSelect}
        target={(toggle) => <Button onClick={toggle}>아이콘 추가</Button>}
      />
    </MantineProvider>,
  );
}

describe("IconPicker", () => {
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

  it("이모지를 누르면 그 아이콘을 선택한다", async () => {
    const onSelect = vi.fn();
    renderPicker(false, onSelect);
    fireEvent.click(screen.getByText("아이콘 추가"));
    fireEvent.click(await screen.findByLabelText("아이콘 🚀"));
    expect(onSelect).toHaveBeenCalledWith("🚀");
  });

  it("직접 입력한 이모지를 Enter로 선택한다", async () => {
    const onSelect = vi.fn();
    renderPicker(false, onSelect);
    fireEvent.click(screen.getByText("아이콘 추가"));
    const input = await screen.findByLabelText("이모지 직접 입력");
    fireEvent.change(input, { target: { value: " 🦄 " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("🦄");
  });

  it("아이콘이 있을 때만 제거 버튼이 보이고 누르면 null을 넘긴다", async () => {
    const onSelect = vi.fn();
    renderPicker(true, onSelect);
    fireEvent.click(screen.getByText("아이콘 추가"));
    fireEvent.click(await screen.findByText("제거"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("아이콘이 없으면 제거 버튼이 없다", async () => {
    renderPicker(false, vi.fn());
    fireEvent.click(screen.getByText("아이콘 추가"));
    await screen.findByText("랜덤");
    expect(screen.queryByText("제거")).toBeNull();
  });
});
