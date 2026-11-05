import { useState } from "react";
import { MantineProvider, Menu } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { MenuToggle } from "./NotionDragHandleMenu";

// 실제 메뉴 안에 켜고 끄는 줄 하나와 일반 항목 하나를 둔 화면
function MenuWithToggle() {
  const [checked, setChecked] = useState(false);
  return (
    <Menu defaultOpened>
      <Menu.Target>
        <button type="button">메뉴</button>
      </Menu.Target>
      <Menu.Dropdown>
        <MenuToggle label="제목 행" icon={null} checked={checked} onToggle={() => setChecked((v) => !v)} />
        <Menu.Item>삭제</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

describe("MenuToggle", () => {
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

  it("켜고 꺼도 메뉴가 닫히지 않고 스위치 상태만 바뀐다", async () => {
    render(
      <MantineProvider>
        <MenuWithToggle />
      </MantineProvider>,
    );
    // 메뉴 전환 효과 중에는 역할 검색에서 숨김으로 보여 이름표로 찾음
    const toggle = await screen.findByLabelText("제목 행");
    expect(toggle.getAttribute("role")).toBe("menuitemcheckbox");
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(toggle);
    expect(screen.getByLabelText("제목 행").getAttribute("aria-checked")).toBe("true");
    // 메뉴가 그대로 열려 있음
    expect(screen.getByText("삭제")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("제목 행"));
    expect(screen.getByLabelText("제목 행").getAttribute("aria-checked")).toBe("false");
  });
});
