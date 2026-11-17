import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CreateSpaceModal } from "./CreateSpaceModal";

function renderModal(onCreate: (kind: string) => void, error: string | null = null) {
  render(
    <MantineProvider>
      <CreateSpaceModal opened pending={false} error={error} onClose={vi.fn()} onCreate={onCreate} />
    </MantineProvider>,
  );
}

describe("CreateSpaceModal", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(cleanup);

  it("기본은 프로젝트로 만든다", async () => {
    const onCreate = vi.fn();
    renderModal(onCreate);
    fireEvent.click(await screen.findByRole("button", { name: "만들기" }));
    expect(onCreate).toHaveBeenCalledWith("PROJECT");
  });

  it("페이지를 고르면 페이지로 만든다", async () => {
    const onCreate = vi.fn();
    renderModal(onCreate);
    fireEvent.click(await screen.findByRole("radio", { name: "페이지" }));
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    expect(onCreate).toHaveBeenCalledWith("PAGE");
  });

  it("만들지 못하면 창 안에 오류를 보인다", async () => {
    renderModal(vi.fn(), "만들지 못했습니다.");
    expect(await screen.findByText("만들지 못했습니다.")).toBeTruthy();
  });
});
